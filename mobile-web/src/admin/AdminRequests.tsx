import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../data';
import type { AttendanceFix, LeaveBalance, LeaveRequest, RequestStatus } from '../data/types';
import { useToast } from '../components/Toast';

const FILTERS: Array<RequestStatus | ''> = ['대기', '승인', '반려', '취소', ''];
const CHIP: Record<RequestStatus, string> = { 대기: 'chip-warn', 승인: 'chip-ok', 반려: 'chip-danger', 취소: '' };

export default function AdminRequests() {
  const toast = useToast();
  const [tab, setTab] = useState<'leave' | 'fix'>('leave');
  const [filter, setFilter] = useState<RequestStatus | ''>('대기');
  const [list, setList] = useState<LeaveRequest[] | null>(null);
  const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);
  const [note, setNote] = useState('');
  const [fixes, setFixes] = useState<AttendanceFix[] | null>(null);
  const [fixRejecting, setFixRejecting] = useState<AttendanceFix | null>(null);
  const [fixNote, setFixNote] = useState('');

  const load = useCallback(async () => {
    const l = await adminApi.listRequests(filter || undefined);
    setList(l);
    const ids = [...new Set(l.map((r) => r.empId))];
    const bs = await Promise.all(ids.map((id) => adminApi.leaveBalanceOf(id)));
    setBalances(Object.fromEntries(ids.map((id, i) => [id, bs[i]])));
  }, [filter]);

  const loadFixes = useCallback(async () => {
    setFixes(await adminApi.listFixes(filter || undefined));
  }, [filter]);

  useEffect(() => {
    if (tab === 'leave') load();
    else loadFixes();
  }, [tab, load, loadFixes]);

  // Approving writes the corrected times into the day's record (server side, in one step).
  async function decideFix(f: AttendanceFix, status: '승인' | '반려', n?: string) {
    try {
      await adminApi.decideFix(f.id, status, n);
      toast(`${f.empName}님 ${f.date} 정정 신청을 ${status}했습니다.`);
      setFixRejecting(null);
      setFixNote('');
      loadFixes();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function decide(r: LeaveRequest, status: '승인' | '반려', n?: string) {
    try {
      await adminApi.decideRequest(r.id, status, n);
      toast(`${r.empName}님의 ${r.type} 신청을 ${status}했습니다.`);
      setRejecting(null);
      setNote('');
      load();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <>
      <div className="admin-head"><h1>신청 승인</h1></div>

      <div className="segmented" role="tablist" aria-label="신청 종류" style={{ maxWidth: 420, marginBottom: 8 }}>
        <button role="tab" aria-selected={tab === 'leave'} aria-pressed={tab === 'leave'} onClick={() => setTab('leave')}>휴가 신청</button>
        <button role="tab" aria-selected={tab === 'fix'} aria-pressed={tab === 'fix'} onClick={() => setTab('fix')}>출퇴근 정정</button>
      </div>

      {tab === 'leave' && (<>
      <div className="segmented" role="group" aria-label="상태 필터" style={{ maxWidth: 420 }}>
        {FILTERS.map((f) => (
          <button key={f || 'all'} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f || '전체'}</button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>신청일</th><th>이름</th><th>종류</th><th>일자 / 시각</th><th>사유</th><th className="num">잔여 연차</th><th>상태</th><th>처리</th></tr></thead>
          <tbody>
            {list === null ? (
              <tr><td colSpan={8} className="muted">불러오는 중…</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={8} className="muted">해당하는 신청이 없습니다.</td></tr>
            ) : (
              list.map((r) => {
                const b = balances[r.empId];
                return (
                  <tr key={r.id}>
                    <td>{r.createdAt.slice(0, 10)}</td>
                    <td><b>{r.empName}</b></td>
                    <td>{r.type}</td>
                    <td>{r.date}{r.endDate && r.endDate !== r.date ? ` ~ ${r.endDate}` : ''}{r.time ? ` ${r.time}` : ''}</td>
                    <td className="wrap">{r.reason}{r.decisionNote && <div className="muted small">처리 메모: {r.decisionNote}</div>}</td>
                    <td className="num">{b ? `${b.total - b.used}일` : '-'}</td>
                    <td><span className={`chip ${CHIP[r.status]}`}>{r.status}</span></td>
                    <td>
                      {r.status === '대기' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-primary" onClick={() => decide(r, '승인')}>승인</button>
                          <button className="btn btn-sm btn-danger" onClick={() => setRejecting(r)}>반려</button>
                        </div>
                      ) : (
                        <span className="muted small">{r.decidedAt?.slice(0, 10) ?? '-'}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </>)}

      {tab === 'fix' && (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>신청일</th><th>이름</th><th>정정 날짜</th><th>출근 → 퇴근</th><th>사유</th><th>상태</th><th>처리</th></tr></thead>
            <tbody>
              {fixes === null ? (
                <tr><td colSpan={7} className="muted">불러오는 중…</td></tr>
              ) : fixes.length === 0 ? (
                <tr><td colSpan={7} className="muted">해당하는 정정 신청이 없습니다.</td></tr>
              ) : (
                fixes.map((f) => (
                  <tr key={f.id}>
                    <td>{f.createdAt.slice(0, 10)}</td>
                    <td><b>{f.empName}</b></td>
                    <td>{f.date}</td>
                    <td>{f.checkIn ?? '-'} → {f.checkOut ?? '-'}</td>
                    <td className="wrap">{f.reason}{f.decisionNote && <div className="muted small">처리 메모: {f.decisionNote}</div>}</td>
                    <td><span className={`chip ${CHIP[f.status]}`}>{f.status}</span></td>
                    <td>
                      {f.status === '대기' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-primary" onClick={() => decideFix(f, '승인')}>승인</button>
                          <button className="btn btn-sm btn-danger" onClick={() => setFixRejecting(f)}>반려</button>
                        </div>
                      ) : (
                        <span className="muted small">{f.decidedAt?.slice(0, 10) ?? '-'}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {fixRejecting && (
        <div className="modal-backdrop" onClick={() => setFixRejecting(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="frej-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="frej-title">{fixRejecting.empName}님 {fixRejecting.date} 정정 반려</h2>
            <div className="field">
              <label htmlFor="frej-note">반려 사유 (직원에게 표시)</label>
              <textarea id="frej-note" className="input" value={fixNote} onChange={(e) => setFixNote(e.target.value)} placeholder="예) 출입 기록과 맞지 않음" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setFixRejecting(null)}>취소</button>
              <button className="btn btn-danger" onClick={() => decideFix(fixRejecting, '반려', fixNote.trim() || undefined)}>반려하기</button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="modal-backdrop" onClick={() => setRejecting(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rej-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="rej-title">{rejecting.empName}님 {rejecting.type} 신청 반려</h2>
            <div className="field">
              <label htmlFor="rej-note">반려 사유 (직원에게 표시)</label>
              <textarea id="rej-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예) 해당 일자 인원 부족" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setRejecting(null)}>취소</button>
              <button className="btn btn-danger" onClick={() => decide(rejecting, '반려', note.trim() || undefined)}>반려하기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
