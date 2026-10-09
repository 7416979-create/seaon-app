import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, adminApi } from '../data';
import { Logo } from '../components/Logo';

// The same link is entered only once per page load, even if the effect runs twice (React StrictMode).
const pending = new Map<string, Promise<unknown>>();
function enterOnce(kind: 'employee' | 'admin', token: string) {
  const key = `${kind}:${token}`;
  if (!pending.has(key)) pending.set(key, kind === 'employee' ? api.enterWithLink(token) : adminApi.enterWithLink(token));
  return pending.get(key)!;
}

export default function EnterLink({ kind }: { kind: 'employee' | 'admin' }) {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    enterOnce(kind, token)
      .then(() => {
        if (!cancelled) navigate(kind === 'employee' ? '/home' : '/admin', { replace: true });
      })
      .catch((e: Error) => {
        // An admin who already used this link on this device is still signed in.
        if (kind === 'admin' && adminApi.currentAdmin()) navigate('/admin', { replace: true });
        else if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, token, navigate]);

  return (
    <div className="splash" style={{ padding: 24, textAlign: 'center' }}>
      <Logo />
      {error ? (
        <>
          <div style={{ fontSize: 20, fontWeight: 800 }}>접속할 수 없어요</div>
          <div className="notice notice-danger" style={{ maxWidth: 360 }}>{error}</div>
          <Link to="/" className="muted small">처음 화면으로</Link>
        </>
      ) : (
        <>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{kind === 'employee' ? '근태웹에 접속하는 중…' : '관리자 화면에 접속하는 중…'}</div>
          <div className="spinner" />
        </>
      )}
    </div>
  );
}
