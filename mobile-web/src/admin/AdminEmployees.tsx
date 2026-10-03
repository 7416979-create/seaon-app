import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminApi } from '../data/demoApi';
import type { Employee, NewEmployee } from '../data/types';
import { todayKey } from '../lib/time';
import { useToast } from '../components/Toast';

const EMPTY: NewEmployee = { empNo: '', name: '', email: '', dept: '', position: '사원', joinDate: todayKey(), annualLeave: 15, password: '' };

export default function AdminEmployees() {
  const toast = useToast();
  const [list, setList] = useState<Employee[] | null>(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<NewEmployee | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => adminApi.listEmployees().then(setList), []);
  useEffect(() => {
    load();
  }, [load]);

  const shown = (list ?? []).filter((e) => !q || [e.name, e.empNo, e.dept, e.email].some((v) => v.toLowerCase().includes(q.toLowerCase())));

  async function create(ev: FormEvent) {
    ev.preventDefault();
    if (!form) return;
    setError('');
    if (!form.empNo.trim() || !form.name.trim() || !form.email.trim()) return setError('사원번호, 이름, 이메일은 필수입니다.');
    if (form.password.length < 4) return setError('초기 비밀번호는 4자 이상으로 정해 주세요.');
    try {
      await adminApi.createEmployee({ ...form, empNo: form.empNo.trim(), name: form.name.trim(), email: form.email.trim() });
      toast(`${form.name}님을 등록했습니다.`);
      setForm(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveEdit(ev: FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    const { id, ...patch } = editing;
    await adminApi.updateEmployee(id, patch);
    toast('저장했습니다.');
    setEditing(null);
    load();
  }

  async function resetPw(e: Employee) {
    const pw = window.prompt(`${e.name}님의 새 비밀번호 (4자 이상)`);
    if (!pw) return;
    if (pw.length < 4) return toast('비밀번호는 4자 이상이어야 합니다.');
    await adminApi.resetPassword(e.id, pw);
    toast(`${e.name}님의 비밀번호를 변경했습니다.`);
  }

  const field = (label: string, key: keyof NewEmployee, type = 'text') =>
    form && (
      <div className="field">
        <label htmlFor={`nf-${key}`}>{label}</label>
        <input id={`nf-${key}`} className="input" type={type} value={String(form[key])}
          onChange={(e) => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} />
      </div>
    );

  return (
    <>
      <div className="admin-head">
        <h1>직원 관리</h1>
        <button className="btn btn-sm btn-primary" onClick={() => { setError(''); setForm({ ...EMPTY }); }}>+ 직원 등록</button>
      </div>

      <div className="toolbar">
        <div className="field" style={{ minWidth: 260 }}>
          <label htmlFor="emp-q">검색</label>
          <input id="emp-q" className="input" placeholder="이름, 사원번호, 부서" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>사원번호</th><th>이름</th><th>부서</th><th>직급</th><th>이메일</th><th>입사일</th><th className="num">연차</th><th>상태</th><th>관리</th></tr></thead>
          <tbody>
            {list === null ? (
              <tr><td colSpan={9} className="muted">불러오는 중…</td></tr>
            ) : (
              shown.map((e) => (
                <tr key={e.id} style={{ opacity: e.active ? 1 : 0.55 }}>
                  <td>{e.empNo}</td><td><b>{e.name}</b></td><td>{e.dept}</td><td>{e.position}</td><td>{e.email}</td><td>{e.joinDate}</td>
                  <td className="num">{e.annualLeave}일</td>
                  <td><span className={`chip ${e.active ? 'chip-ok' : ''}`}>{e.active ? '재직' : '퇴사'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => setEditing({ ...e })}>수정</button>
                      <button className="btn btn-sm btn-outline" onClick={() => resetPw(e)}>비밀번호</button>
                    </div>
                  </td>
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
              {field('사원번호', 'empNo')}
              {field('이름', 'name')}
              {field('부서', 'dept')}
              {field('직급', 'position')}
              {field('이메일', 'email', 'email')}
              {field('입사일', 'joinDate', 'date')}
              {field('연차 일수', 'annualLeave', 'number')}
              {field('초기 비밀번호', 'password', 'text')}
            </div>
            {error && <div className="notice notice-danger" role="alert">{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>취소</button>
              <button className="btn btn-primary">등록</button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ef-title" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <h2 id="ef-title">{editing.name}님 정보 수정</h2>
            <div className="grid-2">
              {(['name', 'dept', 'position', 'email'] as const).map((k) => (
                <div className="field" key={k}>
                  <label htmlFor={`ef-${k}`}>{{ name: '이름', dept: '부서', position: '직급', email: '이메일' }[k]}</label>
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
                  <option value="0">퇴사 (로그인 차단)</option>
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
