import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../data/demoApi';
import type { AttendanceRecord, LeaveBalance, Workplace } from '../data/types';
import { distanceM, getPosition, GeoError, locationPermission } from '../lib/geo';
import { dateKey, formatDuration, hhmm, koreanDate, monthKey, startOfWeek, todayKey, workedMinutes } from '../lib/time';
import { LocationSheet } from '../components/LocationSheet';
import { useToast } from '../components/Toast';

type Action = 'in' | 'out';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export default function Home() {
  const user = api.currentUser()!;
  const toast = useToast();
  const now = useNow();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [workplace, setWorkplace] = useState<Workplace | null>(null);
  const [summary, setSummary] = useState<{ weekMin: number; monthDays: number; leave: LeaveBalance } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<{ mode: 'explain' | 'denied'; action?: Action } | null>(null);
  const [result, setResult] = useState<{ kind: 'ok' | 'danger' | 'warn'; text: string } | null>(null);

  const load = useCallback(async () => {
    const [rec, wp, monthRecs, leave] = await Promise.all([
      api.getRecord(todayKey()),
      api.getWorkplace(),
      api.getRecords(monthKey(new Date())),
      api.leaveBalance(),
    ]);
    const weekStart = dateKey(startOfWeek(new Date()));
    const prevMonth = new Date();
    prevMonth.setDate(0);
    const weekRecs = [...monthRecs, ...(await api.getRecords(monthKey(prevMonth)))].filter((r) => r.date >= weekStart);
    setRecord(rec);
    setWorkplace(wp);
    setSummary({
      weekMin: weekRecs.reduce((s, r) => s + workedMinutes(r.checkIn, r.checkOut), 0),
      monthDays: monthRecs.filter((r) => r.checkIn).length,
      leave,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function start(action: Action) {
    setResult(null);
    if (!workplace) {
      setResult({ kind: 'warn', text: '사업장 위치가 아직 설정되지 않았습니다. 마이페이지에서 먼저 설정해 주세요.' });
      return;
    }
    const perm = await locationPermission();
    if (perm === 'denied') {
      setSheet({ mode: 'denied' });
      return;
    }
    if (perm !== 'granted') {
      setSheet({ mode: 'explain', action });
      return;
    }
    run(action);
  }

  async function run(action: Action) {
    setSheet(null);
    if (!workplace) return;
    setBusy(true);
    try {
      const fix = await getPosition();
      const distance = Math.round(distanceM(fix.lat, fix.lng, workplace.lat, workplace.lng));
      if (distance > workplace.radius) {
        setResult({
          kind: 'danger',
          text: `사업장 범위 밖입니다. 현재 ${workplace.name}에서 약 ${distance.toLocaleString()}m 떨어져 있습니다 (허용 ${workplace.radius}m).`,
        });
        return;
      }
      const loc = { ...fix, distance };
      const rec = action === 'in' ? await api.checkIn(loc) : await api.checkOut(loc);
      setRecord(rec);
      const label = action === 'in' ? '출근' : '퇴근';
      toast(`${label} 완료 · ${hhmm(action === 'in' ? rec.checkIn : rec.checkOut)}`);
      setResult({ kind: 'ok', text: `${label}이 등록되었습니다. (사업장에서 ${distance}m, 정확도 ±${Math.round(fix.accuracy)}m)` });
      load();
    } catch (e) {
      if (e instanceof GeoError && e.code === 'denied') setSheet({ mode: 'denied' });
      else setResult({ kind: 'danger', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const status = !record?.checkIn ? 'before' : !record.checkOut ? 'working' : 'done';
  const worked = workedMinutes(record?.checkIn, record?.checkOut, now);

  return (
    <div className="page">
      <div>
        <div className="muted small">{user.dept} · {user.position}</div>
        <div className="page-title">{user.name}님, 안녕하세요</div>
      </div>

      <section className="card stack" aria-label="오늘 출퇴근">
        <div className="row">
          <span className="muted">{koreanDate(now)}</span>
          <span className={`chip ${status === 'working' ? 'chip-ok' : status === 'done' ? 'chip-primary' : ''}`}>
            {status === 'before' ? '출근 전' : status === 'working' ? '근무 중' : '퇴근 완료'}
          </span>
        </div>
        <div className="clock">{hhmm(now.toISOString())}<span className="muted" style={{ fontSize: 22 }}>:{String(now.getSeconds()).padStart(2, '0')}</span></div>

        <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat"><b>{hhmm(record?.checkIn)}</b><span>출근</span></div>
          <div className="stat"><b>{hhmm(record?.checkOut)}</b><span>퇴근</span></div>
          <div className="stat"><b style={{ fontSize: 15 }}>{record?.checkIn ? formatDuration(worked) : '-'}</b><span>근무시간</span></div>
        </div>

        {status === 'before' && (
          <button className="btn btn-primary btn-xl btn-block" onClick={() => start('in')} disabled={busy}>
            {busy ? '위치 확인 중…' : '출근하기'}
          </button>
        )}
        {status === 'working' && (
          <button className="btn btn-primary btn-xl btn-block" onClick={() => start('out')} disabled={busy}>
            {busy ? '위치 확인 중…' : '퇴근하기'}
          </button>
        )}
        {status === 'done' && <div className="notice notice-ok">오늘 근무를 마쳤습니다. 수고하셨습니다.</div>}

        {result && (
          <div className={`notice notice-${result.kind}`} role="alert">
            {result.text}
            {!workplace && (
              <>
                {' '}
                <Link to="/my">사업장 설정하기 →</Link>
              </>
            )}
          </div>
        )}

        <div className="muted small">
          {workplace ? `사업장: ${workplace.name} (반경 ${workplace.radius}m 안에서 등록 가능)` : '사업장 위치 미설정 · 마이페이지에서 설정하세요'}
        </div>
      </section>

      <section className="card" aria-label="근태 현황">
        <h3>근태 현황</h3>
        <div className="stats">
          <div className="stat"><b style={{ fontSize: 15 }}>{summary ? formatDuration(summary.weekMin) : '-'}</b><span>이번 주 근무</span></div>
          <div className="stat"><b>{summary ? `${summary.monthDays}일` : '-'}</b><span>이번 달 출근</span></div>
          <div className="stat"><b>{summary ? `${summary.leave.total - summary.leave.used}일` : '-'}</b><span>남은 연차</span></div>
        </div>
      </section>

      {sheet && (
        <LocationSheet
          mode={sheet.mode}
          onClose={() => setSheet(null)}
          onConfirm={() => sheet.action && run(sheet.action)}
        />
      )}
    </div>
  );
}
