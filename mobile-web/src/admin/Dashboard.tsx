import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../data';
import type { AttendanceFix, DayRow, LeaveRequest, Policy } from '../data/types';
import { DEFAULT_WORK_START, formatDuration, hhmm, isLate, koreanDate, todayKey, workedMinutes } from '../lib/time';
import { IN_COLOR, MapView, OUT_COLOR, type MapPoint } from '../components/MapView';

export function statusOf(row: DayRow, workStart = DEFAULT_WORK_START): { label: string; cls: string } {
  if (row.leave) return { label: row.leave.type, cls: 'chip-primary' };
  if (!row.record?.checkIn) return { label: '미출근', cls: '' };
  const late = isLate(row.record.checkIn, workStart);
  if (!row.record.checkOut) return { label: late ? '근무 중 · 지각' : '근무 중', cls: late ? 'chip-warn' : 'chip-ok' };
  return { label: '퇴근', cls: '' };
}

export default function Dashboard() {
  const [rows, setRows] = useState<DayRow[] | null>(null);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [pendingFixes, setPendingFixes] = useState<AttendanceFix[]>([]); // 출퇴근 정정 신청 (5차)
  const [todayHoliday, setTodayHoliday] = useState<string | null>(null); // 오늘이 공휴일이면 그 이름 (5차)
  const [policy, setPolicy] = useState<Policy | null>(null);
  const now = new Date();

  useEffect(() => {
    adminApi.dayStatus(todayKey()).then(setRows);
    adminApi.listRequests('대기').then(setPending);
    adminApi.listFixes('대기').then(setPendingFixes);
    adminApi.holidays(todayKey(), todayKey()).then((hs) => setTodayHoliday(hs[0] ? hs[0].name || '공휴일' : null));
    adminApi.getPolicy().then(setPolicy);
  }, []);

  const total = rows?.length ?? 0;
  const inCount = rows?.filter((r) => r.record?.checkIn).length ?? 0;
  const workStart = policy?.workStart ?? DEFAULT_WORK_START;
  const late = rows?.filter((r) => isLate(r.record?.checkIn, workStart)).length ?? 0;
  const onLeave = rows?.filter((r) => r.leave).length ?? 0;
  const absent = total - inCount - onLeave;

  const points = useMemo<MapPoint[]>(() => {
    const out: MapPoint[] = [];
    for (const r of rows ?? []) {
      if (r.record?.inLoc) out.push({ ...r.record.inLoc, color: IN_COLOR, label: `${r.employee.name} 출근 ${hhmm(r.record.checkIn)}` });
      if (r.record?.outLoc) out.push({ ...r.record.outLoc, color: OUT_COLOR, label: `${r.employee.name} 퇴근 ${hhmm(r.record.checkOut)}` });
    }
    return out;
  }, [rows]);
  const wp = policy?.workplace;
  const circle = useMemo(() => (wp ? { lat: wp.lat, lng: wp.lng, radius: wp.radius } : null), [wp]);

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
        <div className="kpi"><span>지각 ({workStart} 이후)</span><b style={{ color: 'var(--warn)' }}>{late}</b></div>
        <div className="kpi"><span>휴가·외출</span><b>{onLeave}</b></div>
        <div className="kpi"><span>미출근</span><b style={{ color: absent ? 'var(--danger)' : undefined }}>{absent}</b></div>
        <div className="kpi"><span>승인 대기 신청</span><b>{pending.length + pendingFixes.length}</b></div>
      </div>

      {todayHoliday && (
        <div className="notice notice-info small" style={{ marginBottom: 8 }}>오늘은 공휴일({todayHoliday})입니다. 근무일 집계에서 빠집니다.</div>
      )}

      {pending.length > 0 && (
        <div className="notice notice-warn row">
          <span>승인을 기다리는 신청이 <b>{pending.length}건</b> 있습니다.</span>
          <Link to="/admin/requests">처리하러 가기 →</Link>
        </div>
      )}

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr><th>이름</th><th>사원번호</th><th>부서</th><th>상태</th><th>출근</th><th>퇴근</th><th className="num">근무시간</th></tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={7} className="muted">불러오는 중…</td></tr>
            ) : (
              rows.map((r) => {
                const s = statusOf(r, workStart);
                return (
                  <tr key={r.employee.id}>
                    <td><b>{r.employee.name}</b> <span className="muted small">{r.employee.position}</span></td>
                    <td>{r.employee.empNo}</td>
                    <td>{r.employee.dept}</td>
                    <td><span className={`chip ${s.cls}`}>{s.label}</span></td>
                    <td>{hhmm(r.record?.checkIn)}</td>
                    <td>{hhmm(r.record?.checkOut)}</td>
                    <td className="num">{r.record?.checkIn ? formatDuration(workedMinutes(r.record.checkIn, r.record.checkOut)) : '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {policy?.locationTracking && (
        <div className="card stack">
          <div className="row">
            <h3 style={{ margin: 0 }}>오늘 출퇴근 위치</h3>
            <div className="legend"><span><i style={{ background: IN_COLOR }} />출근</span><span><i style={{ background: OUT_COLOR }} />퇴근</span>{wp && <span>○ 회사 범위</span>}</div>
          </div>
          {points.length === 0 ? (
            <div className="muted small">오늘 기록된 위치가 없습니다.</div>
          ) : (
            <MapView points={points} circle={circle} height={380} />
          )}
        </div>
      )}
    </>
  );
}
