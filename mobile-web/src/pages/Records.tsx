import { useEffect, useState } from 'react';
import { api } from '../data/demoApi';
import type { AttendanceRecord } from '../data/types';
import { formatDuration, hhmm, monthKey, todayKey, weekdayOf, workedMinutes } from '../lib/time';

export default function Records() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);

  useEffect(() => {
    setRecords(null);
    api.getRecords(monthKey(month)).then(setRecords);
  }, [month]);

  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const isCurrent = monthKey(month) === monthKey(new Date());
  const totalMin = (records ?? []).reduce((s, r) => s + workedMinutes(r.checkIn, r.checkOut), 0);
  const days = (records ?? []).filter((r) => r.checkIn).length;

  return (
    <div className="page">
      <div className="page-title">근태기록</div>

      <div className="card row" style={{ padding: 8 }}>
        <button className="btn btn-sm btn-outline" onClick={() => shift(-1)} aria-label="이전 달">‹</button>
        <b>{month.getFullYear()}년 {month.getMonth() + 1}월</b>
        <button className="btn btn-sm btn-outline" onClick={() => shift(1)} disabled={isCurrent} aria-label="다음 달">›</button>
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="stat"><b>{days}일</b><span>출근일수</span></div>
        <div className="stat"><b style={{ fontSize: 15 }}>{formatDuration(totalMin)}</b><span>총 근무시간</span></div>
      </div>

      <section className="card" aria-label="일자별 기록">
        <h3>일자별 내역</h3>
        {records === null ? (
          <div className="muted">불러오는 중…</div>
        ) : records.length === 0 ? (
          <div className="muted">이 달의 출퇴근 기록이 없습니다.</div>
        ) : (
          <div className="list">
            {records.map((r) => {
              const [, m, d] = r.date.split('-');
              const open = r.checkIn && !r.checkOut;
              return (
                <div key={r.date} className="list-item">
                  <div>
                    <b>{Number(m)}/{Number(d)} ({weekdayOf(r.date)})</b>
                    <div className="muted small">
                      {hhmm(r.checkIn)} ~ {hhmm(r.checkOut)}
                    </div>
                  </div>
                  {open ? (
                    <span className={`chip ${r.date === todayKey() ? 'chip-ok' : 'chip-warn'}`}>
                      {r.date === todayKey() ? '근무 중' : '퇴근 누락'}
                    </span>
                  ) : (
                    <span className="chip">{formatDuration(workedMinutes(r.checkIn, r.checkOut))}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
