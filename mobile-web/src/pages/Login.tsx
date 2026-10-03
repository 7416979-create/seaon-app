import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, IS_DEMO } from '../data/demoApi';
import { Logo } from '../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (api.currentUser()) return <Navigate to="/home" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!id.trim() || !pw) {
      setError('사원번호(이메일)와 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.login(id, pw);
      navigate('/home', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ paddingBottom: 32, justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Logo size={72} />
        <div style={{ fontSize: 22, fontWeight: 800 }}>세아온 근태관리</div>
        <div className="muted small">사원번호 또는 이메일로 로그인하세요</div>
      </div>

      <form className="card stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="login-id">사원번호 / 이메일</label>
          <input id="login-id" className="input" autoComplete="username" inputMode="email" autoCapitalize="none" value={id} onChange={(e) => setId(e.target.value)} placeholder="예) 1001 또는 name@company.com" />
        </div>
        <div className="field">
          <label htmlFor="login-pw">비밀번호</label>
          <input id="login-pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {error && (
          <div className="notice notice-danger" role="alert">
            {error}
          </div>
        )}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </form>

      {IS_DEMO && (
        <div className="notice notice-info small">
          <b>테스트 버전</b> · 데모 계정: 사원번호 <b>1001</b> / 비밀번호 <b>1234</b>
          <br />
          데이터는 이 기기의 브라우저에만 저장됩니다.
        </div>
      )}
    </div>
  );
}
