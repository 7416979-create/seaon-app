import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, adminApi } from '../data';
import { Logo } from '../components/Logo';

export default function Splash() {
  const navigate = useNavigate();
  useEffect(() => {
    const target = api.currentUser() ? '/home' : adminApi.currentAdmin() ? '/admin' : '/login';
    const t = window.setTimeout(() => navigate(target, { replace: true }), 1000);
    return () => window.clearTimeout(t);
  }, [navigate]);

  return (
    <div className="splash">
      <Logo />
      <div style={{ fontSize: 24, fontWeight: 800 }}>세아온 근태웹</div>
      <div className="spinner" aria-label="불러오는 중" />
    </div>
  );
}
