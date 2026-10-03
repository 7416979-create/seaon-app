import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/home', label: '홈', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/records', label: '근태기록', icon: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4' },
  { to: '/requests', label: '신청/연차', icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5' },
  { to: '/mypage', label: '마이페이지', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
]

export default function TabLayout() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="주요 메뉴">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={t.icon} />
            </svg>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
