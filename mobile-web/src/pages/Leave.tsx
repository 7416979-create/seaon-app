import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../data/demoApi';
import { REQUEST_TYPES, type LeaveBalance, type LeaveRequest, type RequestType } from '../data/types';
import { todayKey } from '../lib/time';
import { useToast } from '../components/Toast';

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

  const load = useCallback(async () => {
    const [b, l] = await Promise.all([api.leaveBalance(), api.listRequests()]);
    setBalance(b);
    setList(l);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        <div className="muted small">신청 후 관리자 승인이 필요합니다. (관리자 기능은 서버 연동 후 제공됩니다)</div>
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
