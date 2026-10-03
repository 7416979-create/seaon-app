import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../data/demoApi';
import type { DayRow, LeaveRequest } from '../data/types';
import { formatDuration, hhmm, koreanDate, todayKey, workedMinutes } from '../lib/time';

const LATE_AFTER = { h: 9, m: 0 };

function isLate(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() > LATE_AFTER.h * 60 + LATE_AFTER.m;
}

export function statusOf(row: DayRow): { label: string; cls: string } {
  if (row.leave) return { label: row.leave.type, cls: 'chip-primary' };
  if (!row.record?.checkIn) return { label: '미출근', cls: '' };
  if (!row.record.checkOut) return { label: isLate(row.record.checkIn) ? '근무 중 · 지각' : '근무 중', cls: isLate(row.record.checkIn) ? 'chip-warn' : 'chip-ok' };
  return { label: '퇴근', cls: '' };
}

export default function Dashboard() {
  const [rows, setRows] = useState<DayRow[] | null>(null);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const now = new Date();

  useEffect(() => {
    adminApi.dayStatus(todayKey()).then(setRows);
    adminApi.listRequests('대기').then(setPending);
  }, []);

  const total = rows?.length ?? 0;
  const inCount = rows?.filter((r) => r.record?.checkIn).length ?? 0;
  const late = rows?.filter((r) => isLate(r.record?.checkIn)).length ?? 0;
  const onLeave = rows?.filter((r) => r.leave).length ?? 0;
  const absent = total - inCount - onLeave;

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="muted small">{koreanDate(now)}</div>
          <h1>오늘의 근태 현황</h1>
        </div>
        <Link className="btn btn-sm btn-outline" to="/admin/records">전체 기록 보기 →</Link>
      </div>

      <div className="kpis">
        <div className="kpi"><span>전체 직원</span><b>{total}</b></div>
        <div className="kpi"><span>출근</span><b style={{ color: 'var(--ok)' }}>{inCount}</b></div>
        <div className="kpi"><span>지각 (09:00 이후)</span><b style={{ color: 'var(--warn)' }}>{late}</b></div>
        <div className="kpi"><span>휴가·외출</span><b>{onLeave}</b></div>
        <div className="kpi"><span>미출근</span><b style={{ color: absent ? 'var(--danger)' : undefined }}>{absent}</b></div>
        <div className="kpi"><span>승인 대기 신청</span><b>{pending.length}</b></div>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>이름</th><th>사원번호</th><th>부서</th><th>상태</th><th>출근</th><th>퇴근</th><th className="num">근무시간</th><th className="num">사업장 거리</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={8} className="muted">불러오는 중…</td></tr>
            ) : (
              rows.map((r) => {
                const s = statusOf(r);
                return (
                  <tr key={r.employee.id}>
                    <td><b>{r.employee.name}</b> <span className="muted small">{r.employee.position}</span></td>
                    <td>{r.employee.empNo}</td>
                    <td>{r.employee.dept}</td>
                    <td><span className={`chip ${s.cls}`}>{s.label}</span></td>
                    <td>{hhmm(r.record?.checkIn)}</td>
                    <td>{hhmm(r.record?.checkOut)}</td>
                    <td className="num">{r.record?.checkIn ? formatDuration(workedMinutes(r.record.checkIn, r.record.checkOut)) : '-'}</td>
                    <td className="num">{r.record?.inLoc ? `${r.record.inLoc.distance}m` : '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <div className="notice notice-warn row">
          <span>승인을 기다리는 신청이 <b>{pending.length}건</b> 있습니다.</span>
          <Link to="/admin/requests">처리하러 가기 →</Link>
        </div>
      )}
    </>
  );
}
