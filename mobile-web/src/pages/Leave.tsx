import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../data';
import { REQUEST_TYPES, type AttendanceFix, type AttendanceRecord, type LeaveBalance, type LeaveRequest, type RequestType } from '../data/types';
import { hhmm, todayKey } from '../lib/time';
import { useToast } from '../components/Toast';

// Records screen passes the day to correct through location state: { fixDate: 'YYYY-MM-DD' }.
const FIX_STATUS_CHIP: Record<AttendanceFix['status'], string> = {
  대기: 'chip-warn',
  승인: 'chip-ok',
  반려: 'chip-danger',
  취소: '',
};

const STATUS_CHIP: Record<LeaveRequest['status'], string> = {
  대기: 'chip-warn',
  승인: 'chip-ok',
  반려: 'chip-danger',
  취소: '',
};

export default function Leave() {
  const toast = useToast();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [list, setList] = useState<LeaveRequest[]>([]);
  const [type, setType] = useState<RequestType>('연차');
  const [date, setDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());
  const [time, setTime] = useState('15:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fixes, setFixes] = useState<AttendanceFix[]>([]);
  const [fixDate, setFixDate] = useState(todayKey());
  const [fixIn, setFixIn] = useState('');
  const [fixOut, setFixOut] = useState('');
  const [fixReason, setFixReason] = useState('');
  const [fixError, setFixError] = useState('');
  const [fixBusy, setFixBusy] = useState(false);
  const [fixCurrent, setFixCurrent] = useState<AttendanceRecord | null | undefined>(undefined);
  const location = useLocation();
  const fixCardRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    const [b, l, f] = await Promise.all([api.leaveBalance(), api.listRequests(), api.listFixes()]);
    setBalance(b);
    setList(l);
    setFixes(f);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Opened from a record: pre-fill the date and scroll to the correction form.
  useEffect(() => {
    const day = (location.state as { fixDate?: string } | null)?.fixDate;
    if (!day) return;
    setFixDate(day);
    fixCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.state]);

  // 6차 M3: show the record of the chosen day before the employee changes it. undefined = loading.
  useEffect(() => {
    let alive = true;
    setFixCurrent(undefined);
    api.getRecord(fixDate).then((r) => { if (alive) setFixCurrent(r); }).catch(() => { if (alive) setFixCurrent(null); });
    return () => { alive = false; };
  }, [fixDate]);

  async function submitFix(e: FormEvent) {
    e.preventDefault();
    setFixError('');
    if (!fixIn && !fixOut) return setFixError('출근 또는 퇴근 시각을 입력해 주세요.');
    if (!fixReason.trim()) return setFixError('정정 사유를 입력해 주세요.');
    setFixBusy(true);
    try {
      await api.createFix({ date: fixDate, checkIn: fixIn || undefined, checkOut: fixOut || undefined, reason: fixReason.trim() });
      setFixIn('');
      setFixOut('');
      setFixReason('');
      toast('정정 신청이 접수되었습니다. 관리자 승인 후 기록에 반영됩니다.');
      load();
    } catch (err) {
      setFixError((err as Error).message);
    } finally {
      setFixBusy(false);
    }
  }

  async function cancelFix(id: string) {
    await api.cancelFix(id);
    toast('정정 신청을 취소했습니다.');
    load();
  }

  const needsTime = type === '외출' || type === '조퇴';
  const isRange = type === '연차';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!date) return setError('날짜를 선택해 주세요.');
    if (isRange && endDate < date) return setError('종료일이 시작일보다 빠릅니다.');
    if (!reason.trim()) return setError('사유를 입력해 주세요.');
    setBusy(true);
    try {
      await api.createRequest({
        type,
        date,
        endDate: isRange ? endDate : undefined,
        time: needsTime ? time : undefined,
        reason: reason.trim(),
      });
      setReason('');
      toast(`${type} 신청이 접수되었습니다.`);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    await api.cancelRequest(id);
    toast('신청을 취소했습니다.');
    load();
  }

  const remaining = balance ? balance.total - balance.used : 0;

  return (
    <div className="page">
      <div className="page-title">신청 / 연차</div>

      <section className="card" aria-label="연차 현황">
        <h3>연차 현황</h3>
        <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat"><b>{balance?.total ?? '-'}</b><span>총 연차</span></div>
          <div className="stat"><b>{balance?.used ?? '-'}</b><span>사용</span></div>
          <div className="stat"><b>{balance?.pending ?? '-'}</b><span>승인 대기</span></div>
          <div className="stat"><b>{balance ? remaining : '-'}</b><span>잔여</span></div>
        </div>
      </section>

      <form className="card stack" onSubmit={submit} aria-label="신청서">
        <h3 style={{ margin: 0 }}>새 신청</h3>
        <div className="segmented" role="group" aria-label="신청 종류" style={{ gridAutoColumns: 'auto' }}>
          {REQUEST_TYPES.map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isRange || needsTime ? '1fr 1fr' : '1fr', gap: 10 }}>
          <div className="field">
            <label htmlFor="req-date">{isRange ? '시작일' : '날짜'}</label>
            <input id="req-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {isRange && (
            <div className="field">
              <label htmlFor="req-end">종료일</label>
              <input id="req-end" className="input" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
          {needsTime && (
            <div className="field">
              <label htmlFor="req-time">{type === '외출' ? '외출 시각' : '조퇴 시각'}</label>
              <input id="req-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="req-reason">사유</label>
          <textarea id="req-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예) 개인 사유, 병원 진료" />
        </div>

        {error && <div className="notice notice-danger" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? '접수 중…' : '신청하기'}
        </button>
        <div className="muted small">신청 후 관리자 승인이 필요합니다.</div>
      </form>

      <form className="card stack" onSubmit={submitFix} aria-label="출퇴근 정정 신청" ref={fixCardRef}>
        <h3 style={{ margin: 0 }}>출퇴근 정정 신청</h3>
        <div className="muted small">퇴근을 깜빡했거나 시각이 틀렸을 때 신청합니다. 오늘부터 지난 31일 이내의 날짜만 가능합니다.</div>
        <div className="field">
          <label htmlFor="fix-date">정정할 날짜</label>
          <input id="fix-date" className="input" type="date" value={fixDate} max={todayKey()} onChange={(e) => setFixDate(e.target.value)} />
        </div>
        <div className="notice" style={{ background: 'var(--surface-2)', color: 'var(--text)' }} aria-live="polite">
          {fixCurrent === undefined
            ? <span className="muted">그날 기록을 불러오는 중…</span>
            : fixCurrent
              ? <>현재 기록: 출근 <b>{fixCurrent.checkIn ? hhmm(fixCurrent.checkIn) : '--:--'}</b> / 퇴근 <b>{fixCurrent.checkOut ? hhmm(fixCurrent.checkOut) : '미기록'}</b></>
              : <span className="muted">그날 기록이 없습니다.</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field">
            <label htmlFor="fix-in">출근 시각 (바꿀 때만)</label>
            <input id="fix-in" className="input" type="time" value={fixIn} onChange={(e) => setFixIn(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fix-out">퇴근 시각 (바꿀 때만)</label>
            <input id="fix-out" className="input" type="time" value={fixOut} onChange={(e) => setFixOut(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="fix-reason">사유</label>
          <textarea id="fix-reason" className="input" value={fixReason} onChange={(e) => setFixReason(e.target.value)} placeholder="예) 퇴근 체크를 깜빡함" />
        </div>
        {fixError && <div className="notice notice-danger" role="alert">{fixError}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={fixBusy}>
          {fixBusy ? '접수 중…' : '정정 신청하기'}
        </button>

        {fixes.length > 0 && (
          <div className="list">
            {fixes.map((f) => (
              <div key={f.id} className="list-item">
                <div style={{ minWidth: 0 }}>
                  <b>{f.date}</b>{' '}
                  <span className="muted small">
                    {f.checkIn ?? '-'} → {f.checkOut ?? '-'}
                  </span>
                  <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.reason}</div>
                  {f.decisionNote && <div className="small" style={{ color: 'var(--danger)' }}>관리자: {f.decisionNote}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`chip ${FIX_STATUS_CHIP[f.status]}`}>{f.status}</span>
                  {f.status === '대기' && (
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => cancelFix(f.id)}>취소</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </form>

      <section className="card" aria-label="신청 내역">
        <h3>신청 내역</h3>
        {list.length === 0 ? (
          <div className="muted">신청 내역이 없습니다.</div>
        ) : (
          <div className="list">
            {list.map((r) => (
              <div key={r.id} className="list-item">
                <div style={{ minWidth: 0 }}>
                  <b>{r.type}</b>{' '}
                  <span className="muted small">
                    {r.date}
                    {r.endDate && r.endDate !== r.date ? ` ~ ${r.endDate}` : ''}
                    {r.time ? ` ${r.time}` : ''}
                  </span>
                  <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</div>
                  {r.decisionNote && <div className="small" style={{ color: 'var(--danger)' }}>관리자: {r.decisionNote}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`chip ${STATUS_CHIP[r.status]}`}>{r.status}</span>
                  {r.status === '대기' && (
                    <button className="btn btn-sm btn-outline" onClick={() => cancel(r.id)}>취소</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
