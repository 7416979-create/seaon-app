import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import * as attendance from '../services/attendance'

const statusLabel: Record<attendance.AttendanceStatus, string> = {
  before: '출근 전',
  working: '근무 중',
  done: '퇴근 완료',
}

export default function Home() {
  const { session } = useAuth()
  const employeeNo = session!.user.employeeNo
  const [today, setToday] = useState(() => attendance.getToday(employeeNo))
  const [now, setNow] = useState(() => new Date())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const status = attendance.statusOf(today)
  const monthPrefix = attendance.todayKey().slice(0, 7)
  const monthRecords = attendance.listRecords(employeeNo).filter((r) => r.date.startsWith(monthPrefix))
  const monthMinutes = monthRecords.reduce((sum, r) => sum + attendance.workedMinutes(r, now), 0)

  // GPS verification (workplace radius) is added in the GPS check-in step; this records time only.
  const run = async (action: typeof attendance.checkIn) => {
    setError('')
    setBusy(true)
    try {
      setToday(await action(employeeNo))
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={`${session!.user.name}님, 안녕하세요`}
        subtitle={now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      />
      <section className="card today">
        <div className="today-top">
          <span className={`badge ${status}`}>{statusLabel[status]}</span>
          <span className="clock">{now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        </div>
        <div className="today-times">
          <div>
            <small>출근</small>
            <strong>{attendance.formatTime(today.checkIn)}</strong>
          </div>
          <div>
            <small>퇴근</small>
            <strong>{attendance.formatTime(today.checkOut)}</strong>
          </div>
          <div>
            <small>근무시간</small>
            <strong>{attendance.formatDuration(attendance.workedMinutes(today, now))}</strong>
          </div>
        </div>
        <div className="today-actions">
          <button className="btn primary" disabled={busy || status !== 'before'} onClick={() => run(attendance.checkIn)}>
            출근하기
          </button>
          <button className="btn secondary" disabled={busy || status !== 'working'} onClick={() => run(attendance.checkOut)}>
            퇴근하기
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <section className="card">
        <h2>이번 달 근태 현황</h2>
        <div className="stats">
          <div>
            <strong>{monthRecords.filter((r) => r.checkIn).length}</strong>
            <small>출근일수</small>
          </div>
          <div>
            <strong>{Math.floor(monthMinutes / 60)}</strong>
            <small>누적 근무(시간)</small>
          </div>
          <div>
            <strong>-</strong>
            <small>잔여 연차</small>
          </div>
        </div>
      </section>
    </>
  )
}
