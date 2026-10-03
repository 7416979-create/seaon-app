import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import * as attendance from '../services/attendance'

// Daily list for now; month filter / calendar view comes in the records step.
export default function Records() {
  const { session } = useAuth()
  const records = attendance.listRecords(session!.user.employeeNo)

  return (
    <>
      <PageHeader title="근태기록" subtitle="일자별 출퇴근 내역" />
      {records.length === 0 ? (
        <div className="card empty">아직 출퇴근 기록이 없습니다.</div>
      ) : (
        <ul className="card list">
          {records.map((r) => (
            <li key={r.date}>
              <span className="list-date">{r.date}</span>
              <span>
                {attendance.formatTime(r.checkIn)} ~ {attendance.formatTime(r.checkOut)}
              </span>
              <span className="muted">{attendance.formatDuration(attendance.workedMinutes(r))}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
