import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../data/demoApi';
import type { AttendanceRecord, Employee } from '../data/types';
import { dateKey, formatDuration, hhmm, weekdayOf, workedMinutes } from '../lib/time';
import { IN_COLOR, MapView, OUT_COLOR } from '../components/MapView';

const fmtLoc = (l?: { lat: number; lng: number }) => (l ? `${l.lat.toFixed(6)} ${l.lng.toFixed(6)}` : '');

type Row = AttendanceRecord & { empId: string };

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AdminRecords() {
  const today = new Date();
  const [from, setFrom] = useState(dateKey(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(dateKey(today));
  const [empId, setEmpId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [mapRow, setMapRow] = useState<Row | null>(null);

  useEffect(() => {
    adminApi.listEmployees().then(setEmployees);
  }, []);

  useEffect(() => {
    setRows(null);
    adminApi.records(from, to, empId || undefined).then(setRows);
  }, [from, to, empId]);

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const summary = useMemo(() => {
    const m = new Map<string, { days: number; minutes: number; late: number }>();
    for (const r of rows ?? []) {
      const s = m.get(r.empId) ?? { days: 0, minutes: 0, late: 0 };
      if (r.checkIn) s.days += 1;
      s.minutes += workedMinutes(r.checkIn, r.checkOut);
      const d = r.checkIn ? new Date(r.checkIn) : null;
      if (d && d.getHours() * 60 + d.getMinutes() > 9 * 60) s.late += 1;
      m.set(r.empId, s);
    }
    return m;
  }, [rows]);

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
        <button className="btn btn-sm btn-primary" onClick={exportCsv} disabled={!rows?.length}>엑셀(CSV) 내려받기</button>
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
          <thead><tr><th>이름</th><th>부서</th><th className="num">출근일수</th><th className="num">지각</th><th className="num">총 근무시간</th></tr></thead>
          <tbody>
            {[...summary.entries()].map(([id, s]) => {
              const e = byId.get(id);
              return (
                <tr key={id}>
                  <td><b>{e?.name ?? id}</b></td><td>{e?.dept}</td>
                  <td className="num">{s.days}일</td><td className="num">{s.late}회</td><td className="num">{formatDuration(s.minutes)}</td>
                </tr>
              );
            })}
            {rows && summary.size === 0 && <tr><td colSpan={5} className="muted">기간 내 기록이 없습니다.</td></tr>}
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
                    <td>{hhmm(r.checkIn)}</td>
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
