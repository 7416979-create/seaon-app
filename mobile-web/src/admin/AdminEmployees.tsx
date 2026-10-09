import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { adminApi } from '../data';
import type { Employee, NewEmployee } from '../data/types';
import { todayKey } from '../lib/time';
import { copyText, employeeLink } from '../lib/links';
import { useToast } from '../components/Toast';

const EMPTY: NewEmployee = { empNo: '', name: '', email: '', dept: '', position: '사원', joinDate: todayKey(), annualLeave: 15, phone: '' };

type BulkRow = { line: string; error: string; data: NewEmployee };

// Parses rows pasted from a spreadsheet: 사원번호, 이름, 부서, 직급, 입사일, 연차일수 (tab or comma separated).
function parseBulk(text: string, existing: Set<string>): BulkRow[] {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !/^\s*사원번호/.test(l))
    .map((line) => {
      const cols = (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim());
      const [empNo = '', name = '', dept = '', position = '', joinDate = '', leave = '', phone = ''] = cols;
      const annual = leave === '' ? 15 : Number(leave);
      let error = '';
      if (!empNo || !name) error = '사원번호와 이름은 필수입니다.';
      else if (joinDate && !/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) error = '입사일은 YYYY-MM-DD 형식이어야 합니다.';
      else if (existing.has(empNo) || seen.has(empNo)) error = '사원번호가 중복됩니다.';
      else if (!Number.isFinite(annual) || annual < 0 || annual > 30) error = '연차는 0~30 사이 숫자여야 합니다.';
      else if (phone && !/^[0-9-]{9,13}$/.test(phone)) error = '휴대폰 번호 형식이 올바르지 않습니다.';
      seen.add(empNo);
      return { line, error, data: { empNo, name, email: '', dept, position: position || '사원', joinDate: joinDate || todayKey(), annualLeave: annual, phone } };
    });
}

export default function AdminEmployees() {
  const toast = useToast();
  const [list, setList] = useState<Employee[] | null>(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<NewEmployee | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [created, setCreated] = useState<Employee | null>(null);
  const [error, setError] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResults, setBulkResults] = useState<{ line: string; ok: boolean; msg: string; emp?: Employee }[] | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(() => adminApi.listEmployees().then(setList), []);
  useEffect(() => {
    load();
  }, [load]);

  const shown = (list ?? []).filter((e) => !q || [e.name, e.empNo, e.dept, e.email].some((v) => v.toLowerCase().includes(q.toLowerCase())));
  const bulkRows = useMemo(() => parseBulk(bulkText, new Set((list ?? []).map((e) => e.empNo))), [bulkText, list]);

  async function copyLink(e: Employee) {
    const ok = await copyText(employeeLink(e.linkToken));
    toast(ok ? `${e.name}님 링크를 복사했습니다. 카카오톡·문자로 보내 주세요.` : '복사에 실패했습니다.');
  }

  // One line per person: "이름 (사원번호): 링크"
  async function copyLinks(emps: Employee[]) {
    const text = emps.map((e) => `${e.name} (${e.empNo}): ${employeeLink(e.linkToken)}`).join('\n');
    const ok = await copyText(text);
    toast(ok ? `직원 ${emps.length}명의 링크를 복사했습니다.` : '복사에 실패했습니다.');
  }

  async function registerBulk() {
    setBulkBusy(true);
    const results: { line: string; ok: boolean; msg: string; emp?: Employee }[] = [];
    // One at a time, so the server sees each registration in order.
    for (const r of bulkRows) {
      if (r.error) {
        results.push({ line: r.line, ok: false, msg: r.error });
        continue;
      }
      try {
        const emp = await adminApi.createEmployee(r.data);
        results.push({ line: r.line, ok: true, msg: `${emp.name} 등록 완료`, emp });
      } catch (e) {
        results.push({ line: r.line, ok: false, msg: (e as Error).message });
      }
    }
    setBulkResults(results);
    setBulkBusy(false);
    load();
  }

  async function newLink(e: Employee) {
    if (!window.confirm(`${e.name}님의 링크를 새로 만들까요?\n기존 링크와 기존 기기 로그인은 모두 끊기고, 새 링크는 처음 연 기기 한 대에서만 쓸 수 있습니다. (휴대폰 교체·분실 시 사용)`)) return;
    const token = await adminApi.regenerateLink(e.id);
    await copyText(employeeLink(token));
    toast(`새 링크를 만들고 복사했습니다. ${e.name}님께 다시 보내 주세요.`);
    load();
  }

  async function create(ev: FormEvent) {
    ev.preventDefault();
    if (!form) return;
    setError('');
    if (!form.empNo.trim() || !form.name.trim()) return setError('사원번호와 이름은 필수입니다.');
    try {
      const emp = await adminApi.createEmployee({ ...form, empNo: form.empNo.trim(), name: form.name.trim(), email: form.email.trim() });
      setForm(null);
      setCreated(emp);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveEdit(ev: FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    const { id, linkToken: _t, ...patch } = editing;
    void _t;
    await adminApi.updateEmployee(id, patch);
    toast('저장했습니다.');
    setEditing(null);
    load();
  }

  const field = (label: string, key: keyof NewEmployee, type = 'text', required = false) =>
    form && (
      <div className="field">
        <label htmlFor={`nf-${key}`}>{label}{required && ' *'}</label>
        <input id={`nf-${key}`} className="input" type={type} value={String(form[key])}
          onChange={(e) => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} />
      </div>
    );

  return (
    <>
      <div className="admin-head">
        <h1>직원 관리</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-outline" onClick={() => copyLinks((list ?? []).filter((e) => e.active).sort((a, b) => a.empNo.localeCompare(b.empNo)))} disabled={!list?.some((e) => e.active)}>전체 링크 복사</button>
          <button className="btn btn-sm btn-outline" onClick={() => { setBulkText(''); setBulkResults(null); setBulkOpen(true); }}>여러 명 등록</button>
          <button className="btn btn-sm btn-primary" onClick={() => { setError(''); setForm({ ...EMPTY }); }}>+ 직원 등록</button>
        </div>
      </div>

      <div className="notice notice-info small">
        직원은 비밀번호 없이 <b>개인 링크</b>로 접속합니다. "링크 복사"를 눌러 카카오톡·문자로 보내 주세요. 휴대폰을 바꾸거나 링크가 새어 나갔다면 "새 링크"를 누르세요.
      </div>

      <div className="toolbar">
        <div className="field" style={{ minWidth: 260 }}>
          <label htmlFor="emp-q">검색</label>
          <input id="emp-q" className="input" placeholder="이름, 사원번호, 부서" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>사원번호</th><th>이름</th><th>휴대폰</th><th>부서</th><th>직급</th><th>입사일</th><th className="num">연차</th><th>상태</th><th>개인 링크</th><th>관리</th></tr></thead>
          <tbody>
            {list === null ? (
              <tr><td colSpan={10} className="muted">불러오는 중…</td></tr>
            ) : (
              shown.map((e) => (
                <tr key={e.id} style={{ opacity: e.active ? 1 : 0.55 }}>
                  <td>{e.empNo}</td><td><b>{e.name}</b></td><td>{e.phone || '-'}</td><td>{e.dept}</td><td>{e.position}</td><td>{e.joinDate}</td>
                  <td className="num">{e.annualLeave}일</td>
                  <td><span className={`chip ${e.active ? 'chip-ok' : ''}`}>{e.active ? '재직' : '퇴사'}</span></td>
                  <td>
                    <div className="link-cell"><span className={`chip ${e.linkUsedAt ? 'chip-ok' : ''}`} title={e.linkUsedAt ? `등록: ${new Date(e.linkUsedAt).toLocaleString('ko-KR')}` : undefined}>{e.linkUsedAt ? '기기 등록됨' : '미사용'}</span>
                      <button className="btn btn-sm btn-primary" onClick={() => copyLink(e)} disabled={!e.active}>링크 복사</button>
                      <button className="btn btn-sm btn-outline" onClick={() => newLink(e)}>새 링크</button>
                    </div>
                  </td>
                  <td><button className="btn btn-sm btn-outline" onClick={() => setEditing({ ...e })}>수정</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-backdrop" onClick={() => setForm(null)}>
          <form className="modal" role="dialog" aria-modal="true" aria-labelledby="nf-title" onClick={(e) => e.stopPropagation()} onSubmit={create}>
            <h2 id="nf-title">직원 등록</h2>
            <div className="grid-2">
              {field('사원번호', 'empNo', 'text', true)}
              {field('이름', 'name', 'text', true)}
              {field('부서', 'dept')}
              {field('직급', 'position')}
              {field('이메일 (선택)', 'email', 'email')}
              {field('휴대폰 (선택)', 'phone', 'tel')}
              {field('입사일', 'joinDate', 'date')}
              {field('연차 일수', 'annualLeave', 'number')}
            </div>
            {error && <div className="notice notice-danger" role="alert">{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>취소</button>
              <button className="btn btn-primary">등록</button>
            </div>
          </form>
        </div>
      )}

      {bulkOpen && (
        <div className="modal-backdrop" onClick={() => !bulkBusy && setBulkOpen(false)}>
          <div className="modal" style={{ maxWidth: 720 }} role="dialog" aria-modal="true" aria-labelledby="bk-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="bk-title">여러 명 등록</h2>
            <div className="muted small">엑셀에서 아래 순서대로 복사해 붙여 넣으세요: 사원번호, 이름, 부서, 직급, 입사일(YYYY-MM-DD), 연차일수, 휴대폰(선택). 부서 이후는 비워도 됩니다. 첫 줄이 '사원번호'로 시작하는 머리글은 자동으로 건너뜁니다.</div>
            <textarea className="input" rows={7} aria-label="직원 명단" placeholder={'T001\t홍길동\t영업팀\t사원\t2026-10-01\t15'} value={bulkText} onChange={(e) => { setBulkText(e.target.value); setBulkResults(null); }} disabled={bulkBusy} />

            {!bulkResults && bulkRows.length > 0 && (
              <div className="table-wrap" style={{ maxHeight: 260 }}>
                <table className="tbl">
                  <thead><tr><th>사원번호</th><th>이름</th><th>부서</th><th>직급</th><th>입사일</th><th className="num">연차</th><th>확인</th></tr></thead>
                  <tbody>
                    {bulkRows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.data.empNo}</td><td>{r.data.name}</td><td>{r.data.dept}</td><td>{r.data.position}</td><td>{r.data.joinDate}</td>
                        <td className="num">{r.data.annualLeave}</td>
                        <td>{r.error ? <span className="chip chip-warn">{r.error}</span> : <span className="chip chip-ok">등록 가능</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bulkResults && (
              <div className="stack">
                {bulkResults.map((r, i) => (
                  <div key={i} className={`notice ${r.ok ? 'notice-info' : 'notice-danger'} small`}>{r.ok ? '✓' : '✗'} {r.msg}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>닫기</button>
              {bulkResults && bulkResults.some((r) => r.ok) && (
                <button type="button" className="btn btn-outline" onClick={() => copyLinks(bulkResults.filter((r) => r.ok && r.emp).map((r) => r.emp!))}>방금 등록한 직원 링크 복사</button>
              )}
              {!bulkResults && (
                <button type="button" className="btn btn-primary" onClick={registerBulk} disabled={bulkBusy || bulkRows.every((r) => r.error)}>
                  {bulkBusy ? '등록 중…' : `${bulkRows.filter((r) => !r.error).length}명 등록`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {created && (
        <div className="modal-backdrop" onClick={() => setCreated(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cr-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="cr-title">{created.name}님을 등록했습니다</h2>
            <div className="muted">아래 개인 링크를 {created.name}님께 보내 주세요. 링크를 누르면 바로 접속됩니다.</div>
            <div className="notice notice-info small" style={{ wordBreak: 'break-all' }}>{employeeLink(created.linkToken)}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setCreated(null)}>닫기</button>
              <button className="btn btn-primary" onClick={() => copyLink(created)}>링크 복사</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ef-title" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <h2 id="ef-title">{editing.name}님 정보 수정</h2>
            <div className="grid-2">
              {(['name', 'dept', 'position', 'email', 'phone'] as const).map((k) => (
                <div className="field" key={k}>
                  <label htmlFor={`ef-${k}`}>{{ name: '이름', dept: '부서', position: '직급', email: '이메일', phone: '휴대폰' }[k]}</label>
                  <input id={`ef-${k}`} className="input" value={editing[k]} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} />
                </div>
              ))}
              <div className="field">
                <label htmlFor="ef-leave">연차 일수</label>
                <input id="ef-leave" className="input" type="number" value={editing.annualLeave} onChange={(e) => setEditing({ ...editing, annualLeave: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="ef-active">재직 상태</label>
                <select id="ef-active" className="input" value={editing.active ? '1' : '0'} onChange={(e) => setEditing({ ...editing, active: e.target.value === '1' })}>
                  <option value="1">재직</option>
                  <option value="0">퇴사 (접속 차단)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>취소</button>
              <button className="btn btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
