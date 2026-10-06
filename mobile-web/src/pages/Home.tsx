import { useCallback, useEffect, useState } from 'react';
import { api } from '../data/demoApi';
import { MAX_EDIT_METERS, type AttendanceRecord, type CheckLocation, type LeaveBalance, type Policy } from '../data/types';
import { distanceM, getPosition, GeoError, locationPermission } from '../lib/geo';
import { dateKey, formatDuration, hhmm, koreanDate, monthKey, startOfWeek, todayKey, workedMinutes } from '../lib/time';
import { LocationSheet } from '../components/LocationSheet';
import { ResultPopup } from '../components/ResultPopup';
import { InstallBanner } from '../components/InstallBanner';
import { MyLocationCard } from '../components/MyLocationCard';

type Action = 'in' | 'out';
const LOC_EXPLAINED_KEY = 'seaon.locExplained';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

const ICON_IN = 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3';
const ICON_OUT = 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9';

function PunchIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function Home() {
  const user = api.currentUser()!;
  const now = useNow();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [summary, setSummary] = useState<{ weekMin: number; monthDays: number; leave: LeaveBalance } | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [sheet, setSheet] = useState<{ mode: 'explain' | 'denied'; action?: Action } | null>(null);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState<{ kind: Action; record: AttendanceRecord } | null>(null);
  const [manual, setManual] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback(async () => {
    const [rec, pol, monthRecs, leave] = await Promise.all([
      api.getRecord(todayKey()),
      api.getPolicy(),
      api.getRecords(monthKey(new Date())),
      api.leaveBalance(),
    ]);
    const weekStart = dateKey(startOfWeek(new Date()));
    const prevMonth = new Date();
    prevMonth.setDate(0);
    const weekRecs = [...monthRecs, ...(await api.getRecords(monthKey(prevMonth)))].filter((r) => r.date >= weekStart);
    setRecord(rec);
    setPolicy(pol);
    setSummary({
      weekMin: weekRecs.reduce((s, r) => s + workedMinutes(r.checkIn, r.checkOut), 0),
      monthDays: monthRecs.filter((r) => r.checkIn).length,
      leave,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const needsLocation = !!policy && (policy.locationTracking || policy.geofence);
  const canEdit = !!policy?.showEmployeeMap && !!policy.allowLocationEdit;

  async function start(action: Action) {
    setError('');
    if (!needsLocation) return run(action);
    const perm = await locationPermission();
    if (perm === 'denied' && policy?.geofence) return setSheet({ mode: 'denied' });
    let explained = false;
    try {
      explained = localStorage.getItem(LOC_EXPLAINED_KEY) === '1';
    } catch {
      // ignore
    }
    if (perm !== 'granted' && perm !== 'denied' && !explained) return setSheet({ mode: 'explain', action });
    run(action);
  }

  async function locate(): Promise<CheckLocation | null> {
    if (!needsLocation || !policy) return null;
    try {
      const fix = await getPosition();
      // A pin the employee moved is used only if editing is allowed and it stays near the real GPS fix.
      const useManual = canEdit && manual && distanceM(fix.lat, fix.lng, manual.lat, manual.lng) <= MAX_EDIT_METERS;
      if (canEdit && manual && !useManual) throw new Error(`수정한 위치가 실제 위치에서 ${MAX_EDIT_METERS}m 넘게 떨어져 있습니다. "원래대로"를 누르고 다시 시도하세요.`);
      const spot = useManual ? manual : fix;
      const wp = policy.workplace;
      const distance = wp ? Math.round(distanceM(spot.lat, spot.lng, wp.lat, wp.lng)) : undefined;
      if (policy.geofence && wp && distance !== undefined && distance > wp.radius) {
        throw new Error('회사 근처에서만 출퇴근할 수 있습니다.');
      }
      return useManual
        ? { lat: spot.lat, lng: spot.lng, accuracy: fix.accuracy, distance, edited: true, gps: { lat: fix.lat, lng: fix.lng } }
        : { ...fix, distance };
    } catch (e) {
      // Without the geofence rule, a missing location never blocks check-in.
      if (!policy.geofence && e instanceof GeoError) return null;
      throw e;
    }
  }

  async function run(action: Action) {
    setSheet(null);
    try {
      localStorage.setItem(LOC_EXPLAINED_KEY, '1');
    } catch {
      // ignore
    }
    setBusy(action);
    try {
      const loc = await locate();
      const rec = action === 'in' ? await api.checkIn(loc) : await api.checkOut(loc);
      setRecord({ ...rec });
      setPopup({ kind: action, record: rec });
      load();
    } catch (e) {
      if (e instanceof GeoError && e.code === 'denied') setSheet({ mode: 'denied' });
      else setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const checkedIn = !!record?.checkIn;
  const checkedOut = !!record?.checkOut;
  const worked = workedMinutes(record?.checkIn, record?.checkOut, now);

  return (
    <div className="page home">
      <InstallBanner />

      <div>
        <div className="muted small">{koreanDate(now)}</div>
        <div className="page-title">{user.name}님, 안녕하세요</div>
      </div>

      <div className="punch-grid">
        <button className="punch punch-in" onClick={() => start('in')} disabled={checkedIn || busy !== null} aria-label="출근하기">
          <PunchIcon d={ICON_IN} />
          <span className="punch-label">출근</span>
          <span className="punch-sub">{busy === 'in' ? '확인 중…' : checkedIn ? hhmm(record?.checkIn) : '눌러서 출근'}</span>
        </button>
        <button className="punch punch-out" onClick={() => start('out')} disabled={!checkedIn || checkedOut || busy !== null} aria-label="퇴근하기">
          <PunchIcon d={ICON_OUT} />
          <span className="punch-label">퇴근</span>
          <span className="punch-sub">{busy === 'out' ? '확인 중…' : checkedOut ? hhmm(record?.checkOut) : checkedIn ? '눌러서 퇴근' : '출근 후 가능'}</span>
        </button>
      </div>

      {error && (
        <div className="notice notice-danger" role="alert">
          {error}
        </div>
      )}

      <section className="card" aria-label="오늘 출퇴근 기록">
        <h3>오늘 기록</h3>
        <div className="stats">
          <div className="stat"><b>{hhmm(record?.checkIn)}</b><span>출근</span></div>
          <div className="stat"><b>{hhmm(record?.checkOut)}</b><span>퇴근</span></div>
          <div className="stat"><b style={{ fontSize: 15 }}>{checkedIn ? formatDuration(worked) : '-'}</b><span>근무시간</span></div>
        </div>
      </section>

      {policy?.showEmployeeMap && (
        <MyLocationCard workplace={policy.workplace} allowEdit={canEdit} manual={canEdit ? manual : null} onManual={setManual} />
      )}

      <section className="card" aria-label="근태 현황">
        <h3>근태 현황</h3>
        <div className="stats">
          <div className="stat"><b style={{ fontSize: 15 }}>{summary ? formatDuration(summary.weekMin) : '-'}</b><span>이번 주 근무</span></div>
          <div className="stat"><b>{summary ? `${summary.monthDays}일` : '-'}</b><span>이번 달 출근</span></div>
          <div className="stat"><b>{summary ? `${summary.leave.total - summary.leave.used}일` : '-'}</b><span>남은 연차</span></div>
        </div>
      </section>

      <div className="now-clock" aria-label="현재 시각">
        {hhmm(now.toISOString())}
        <span>:{String(now.getSeconds()).padStart(2, '0')}</span>
      </div>

      {sheet && (
        <LocationSheet mode={sheet.mode} onClose={() => setSheet(null)} onConfirm={() => sheet.action && run(sheet.action)} />
      )}
      {popup && <ResultPopup kind={popup.kind} record={popup.record} onClose={() => setPopup(null)} />}
    </div>
  );
}
