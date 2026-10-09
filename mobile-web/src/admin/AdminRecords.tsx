import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../data';
import type { AttendanceRecord, Employee, Holiday, LeaveRequest, Policy } from '../data/types';
import { DEFAULT_WORK_START, dateKey, formatDuration, hhmm, isLate, weekdayOf, workedMinutes } from '../lib/time';
import { IN_COLOR, MapView, OUT_COLOR } from '../components/MapView';

const fmtLoc = (l?: { lat: number; lng: number }) => (l ? `${l.lat.toFixed(6)} ${l.lng.toFixed(6)}` : '');

type Row = AttendanceRecord & { empId: string };

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── Monthly summary helpers (5차 L6) ──────────────────────────────────

// Every date from a to b (YYYY-MM-DD), inclusive.
function daysBetween(a: string, b: string): string[] {
  const out: string[] = [];
  const [y, m, d] = a.split('-').map(Number);
  const end = new Date(...(b.split('-').map(Number) as [number, number, number]));
  for (let t = new Date(y, m - 1, d); t <= end; t.setDate(t.getDate() + 1)) out.push(dateKey(t));
  return out;
}

// Working days: weekdays that are not public holidays, up to the end date (never future days).
function workingDays(from: string, to: string, holidays: Holiday[]): Set<string> {
  const off = new Set(holidays.map((h) => h.date));
  const set = new Set<string>();
  for (const day of daysBetween(from, to)) {
    const [y, m, d] = day.split('-').map(Number);
    const w = new Date(y, m - 1, d).getDay();
    if (w !== 0 && w !== 6 && !off.has(day)) set.add(day);
  }
  return set;
}

// Leave days of one approved request inside the working days. 연차 = 1 per day, 반차 = 0.5, 외출·조퇴 = 0.
function leaveDaysOf(r: LeaveRequest, working: Set<string>): number {
  if (r.type !== '연차' && r.type !== '오전반차' && r.type !== '오후반차') return 0;
  const per = r.type === '연차' ? 1 : 0.5;
  return daysBetween(r.date, r.endDate ?? r.date).filter((d) => working.has(d)).length * per;
}

export default function AdminRecords() {
  const today = new Date();
  const [from, setFrom] = useState(dateKey(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(dateKey(today));
  const [empId, setEmpId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [mapRow, setMapRow] = useState<Row | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [approved, setApproved] = useState<LeaveRequest[]>([]);


  useEffect(() => {
    adminApi.listEmployees().then(setEmployees);
    adminApi.getPolicy().then(setPolicy);
  }, []);

  const workStart = policy?.workStart ?? DEFAULT_WORK_START;

  useEffect(() => {
    setRows(null);
    adminApi.records(from, to, empId || undefined).then(setRows);
    adminApi.holidays(from, to).then(setHolidays);
    adminApi.listRequests('승인').then(setApproved);
  }, [from, to, empId]);

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  // Per employee: 근무일수, 출근일수, 지각, 휴가, 결근, 총 근무시간.
  // 결근 = 근무일수 - 출근일수 - 휴가 (0 미만이면 0). Holidays and future days are not counted.
  const monthly = useMemo(() => {
    const working = workingDays(from, to > dateKey(today) ? dateKey(today) : to, holidays);
    const m = new Map<string, { workDays: number; days: number; late: number; leave: number; absent: number; minutes: number }>();
    for (const r of rows ?? []) {
      const s = m.get(r.empId) ?? { workDays: working.size, days: 0, late: 0, leave: 0, absent: 0, minutes: 0 };
      if (r.checkIn && working.has(r.date)) s.days += 1;
      if (isLate(r.checkIn, workStart)) s.late += 1;
      s.minutes += workedMinutes(r.checkIn, r.checkOut);
      m.set(r.empId, s);
    }
    for (const lr of approved) {
      if (!m.has(lr.empId)) continue;
      const s = m.get(lr.empId)!;
      s.leave += leaveDaysOf(lr, working);
    }
    for (const s of m.values()) s.absent = Math.max(0, s.workDays - s.days - s.leave);
    return m;
  }, [rows, approved, holidays, from, to, workStart]);

  function setPreset(kind: 'thisMonth' | 'lastMonth') {
    const base = kind === 'thisMonth' ? new Date(today.getFullYear(), today.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = kind === 'thisMonth' ? dateKey(today) : dateKey(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    setFrom(dateKey(base));
    setTo(end);
  }

  function exportSummaryCsv() {
    const header = ['이름', '사원번호', '부서', '근무일수', '출근일수', '지각', '휴가(일)', '결근(일)', '총 근무(분)'];
    const lines = [...monthly.entries()].map(([id, s]) => {
      const e = byId.get(id);
      return [e?.name ?? id, e?.empNo ?? '', e?.dept ?? '', s.workDays, s.days, s.late, s.leave, s.absent, s.minutes].map(csvCell).join(',');
    });
    const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `근태요약_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportCsv() {
    const header = ['날짜', '요일', '사원번호', '이름', '부서', '출근', '퇴근', '근무(분)', '출근 위치(위도 경도)', '퇴근 위치(위도 경도)'];
    const lines = (rows ?? []).map((r) => {
      const e = byId.get(r.empId);
      return [r.date, weekdayOf(r.date), e?.empNo ?? '', e?.name ?? r.empId, e?.dept ?? '', hhmm(r.checkIn), hhmm(r.checkOut), workedMinutes(r.checkIn, r.checkOut), fmtLoc(r.inLoc), fmtLoc(r.outLoc)]
        .map(csvCell)
        .join(',');
    });
    // BOM so Excel opens Korean text correctly.
    const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `근태기록_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="admin-head">
        <h1>근태 기록</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-outline" onClick={exportSummaryCsv} disabled={monthly.size === 0}>요약 내려받기</button>
          <button className="btn btn-sm btn-primary" onClick={exportCsv} disabled={!rows?.length}>엑셀(CSV) 내려받기</button>
        </div>
      </div>

      <div className="segmented" role="group" aria-label="기간 빠른 선택" style={{ maxWidth: 320, marginBottom: 8 }}>
        <button onClick={() => setPreset('thisMonth')}>이번 달</button>
        <button onClick={() => setPreset('lastMonth')}>지난 달</button>
      </div>

      <div className="toolbar">
        <div className="field"><label htmlFor="f-from">시작일</label><input id="f-from" className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label htmlFor="f-to">종료일</label><input id="f-to" className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="field">
          <label htmlFor="f-emp">직원</label>
          <select id="f-emp" className="input" value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">전체</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.empNo})</option>)}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>이름</th><th>부서</th><th className="num">근무일수</th><th className="num">출근일수</th><th className="num">지각</th><th className="num">휴가</th><th className="num">결근</th><th className="num">총 근무시간</th></tr></thead>
          <tbody>
            {[...monthly.entries()].map(([id, s]) => {
              const e = byId.get(id);
              return (
                <tr key={id}>
                  <td><b>{e?.name ?? id}</b></td><td>{e?.dept}</td>
                  <td className="num">{s.workDays}일</td><td className="num">{s.days}일</td><td className="num">{s.late}회</td>
                  <td className="num">{s.leave}일</td><td className="num">{s.absent}일</td><td className="num">{formatDuration(s.minutes)}</td>
                </tr>
              );
            })}
            {rows && monthly.size === 0 && <tr><td colSpan={8} className="muted">기간 내 기록이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="table-wrap" style={{ maxHeight: 560 }}>
        <table className="tbl">
          <thead><tr><th>날짜</th><th>이름</th><th>부서</th><th>출근</th><th>퇴근</th><th className="num">근무시간</th><th>위치</th></tr></thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={7} className="muted">불러오는 중…</td></tr>
            ) : (
              rows.map((r) => {
                const e = byId.get(r.empId);
                return (
                  <tr key={r.empId + r.date}>
                    <td>{r.date} ({weekdayOf(r.date)})</td>
                    <td>{e?.name ?? r.empId}</td>
                    <td>{e?.dept}</td>
                    <td>{hhmm(r.checkIn)} {r.fixed && <span className="chip chip-ok">정정됨</span>}</td>
                    <td>{r.checkOut ? hhmm(r.checkOut) : <span className="chip chip-warn">미기록</span>}</td>
                    <td className="num">{formatDuration(workedMinutes(r.checkIn, r.checkOut))}</td>
                    <td>
                      {r.inLoc || r.outLoc ? (
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button className="btn btn-sm btn-outline" onClick={() => setMapRow(r)}>지도</button>
                          {(r.inLoc?.edited || r.outLoc?.edited) && <span className="chip chip-warn">직원 수정</span>}
                        </span>
                      ) : (
                        <span className="muted small">없음</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {mapRow && (
        <div className="modal-backdrop" onClick={() => setMapRow(null)}>
          <div className="modal" style={{ maxWidth: 720 }} role="dialog" aria-modal="true" aria-labelledby="map-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="map-title">{byId.get(mapRow.empId)?.name ?? ''} · {mapRow.date} ({weekdayOf(mapRow.date)})</h2>
            <div className="legend">
              <span><i style={{ background: IN_COLOR }} />출근 {hhmm(mapRow.checkIn)}</span>
              <span><i style={{ background: OUT_COLOR }} />퇴근 {hhmm(mapRow.checkOut)}</span>
            </div>
            <MapView
              height={400}
              points={[
                ...(mapRow.inLoc ? [{ ...mapRow.inLoc, color: IN_COLOR, label: `출근 ${hhmm(mapRow.checkIn)}${mapRow.inLoc.edited ? ' · 직원 수정' : ''} (오차 ±${Math.round(mapRow.inLoc.accuracy)}m)` }] : []),
                ...(mapRow.inLoc?.gps ? [{ ...mapRow.inLoc.gps, color: '#9aa4b8', label: '출근 시 실제 GPS 위치' }] : []),
                ...(mapRow.outLoc ? [{ ...mapRow.outLoc, color: OUT_COLOR, label: `퇴근 ${hhmm(mapRow.checkOut)}${mapRow.outLoc.edited ? ' · 직원 수정' : ''} (오차 ±${Math.round(mapRow.outLoc.accuracy)}m)` }] : []),
                ...(mapRow.outLoc?.gps ? [{ ...mapRow.outLoc.gps, color: '#9aa4b8', label: '퇴근 시 실제 GPS 위치' }] : []),
              ]}
            />
            {(mapRow.inLoc?.edited || mapRow.outLoc?.edited) && (
              <div className="notice notice-warn small">직원이 위치를 직접 수정한 기록입니다. 회색 점이 실제 GPS 위치입니다.</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setMapRow(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
