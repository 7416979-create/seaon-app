import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { adminApi, IS_DEMO } from '../data/demoApi';
import { Logo } from '../components/Logo';
import './admin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (adminApi.currentAdmin()) return <Navigate to="/admin" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminApi.login(id, pw);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <form className="card stack" onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo size={44} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 19 }}>근태관리 관리자</div>
            <div className="muted small">관리자 계정으로 로그인하세요</div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="admin-id">아이디</label>
          <input id="admin-id" className="input" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="admin-pw">비밀번호</label>
          <input id="admin-pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {error && <div className="notice notice-danger" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        {IS_DEMO && (
          <div className="notice notice-info small">
            <b>테스트 버전</b> · 관리자 데모 계정: <b>admin</b> / <b>admin1234</b>
          </div>
        )}
        <a className="small muted" href="#/login" style={{ textAlign: 'center' }}>직원용 화면으로 이동</a>
      </form>
    </div>
  );
}
