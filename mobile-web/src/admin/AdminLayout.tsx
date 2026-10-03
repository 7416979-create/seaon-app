import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { adminApi, IS_DEMO } from '../data/demoApi';
import { Logo } from '../components/Logo';
import './admin.css';

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const MENU = [
  { to: '/admin', end: true, label: '대시보드', d: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { to: '/admin/records', label: '근태 기록', d: 'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
  { to: '/admin/requests', label: '신청 승인', d: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9' },
  { to: '/admin/employees', label: '직원 관리', d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { to: '/admin/settings', label: '사업장 설정', d: 'M12 22s-8-6-8-12a8 8 0 1 1 16 0c0 6-8 12-8 12zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const admin = adminApi.currentAdmin();
  if (!admin) return <Navigate to="/admin/login" replace />;

  async function logout() {
    await adminApi.logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="admin">
      <aside className="admin-side" aria-label="관리자 메뉴">
        <div className="admin-brand">
          <Logo size={34} /> 근태관리 관리자
        </div>
        {MENU.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            {icon(m.d)}
            {m.label}
          </NavLink>
        ))}
        <div className="spacer" />
        {IS_DEMO && <div className="chip chip-warn" style={{ margin: '0 8px 8px', justifyContent: 'center' }}>테스트 버전 · 샘플 데이터</div>}
        <button className="btn btn-sm btn-outline" style={{ margin: '0 8px' }} onClick={logout}>
          로그아웃 ({admin.name})
        </button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
