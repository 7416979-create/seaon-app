import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { api } from './data';
import { TabBar } from './components/TabBar';
import { ToastProvider } from './components/Toast';
import Splash from './pages/Splash';
import Login from './pages/Login';
import EnterLink from './pages/EnterLink';
import Home from './pages/Home';
import Records from './pages/Records';
import Leave from './pages/Leave';
import MyPage from './pages/MyPage';
import AdminLayout from './admin/AdminLayout';
import AdminLogin from './admin/AdminLogin';
import Dashboard from './admin/Dashboard';
import AdminRecords from './admin/AdminRecords';
import AdminRequests from './admin/AdminRequests';
import AdminEmployees from './admin/AdminEmployees';
import AdminSettings from './admin/AdminSettings';

function MobileShell() {
  return (
    <div className="app">
      <Outlet />
    </div>
  );
}

function RequireAuth() {
  if (!api.currentUser()) return <Navigate to="/login" replace />;
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route element={<MobileShell />}>
            <Route path="/" element={<Splash />} />
            <Route path="/login" element={<Login />} />
            <Route path="/e/:token" element={<EnterLink kind="employee" />} />
            <Route path="/a/:token" element={<EnterLink kind="admin" />} />
            <Route element={<RequireAuth />}>
              <Route path="/home" element={<Home />} />
              <Route path="/records" element={<Records />} />
              <Route path="/leave" element={<Leave />} />
              <Route path="/my" element={<MyPage />} />
            </Route>
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="records" element={<AdminRecords />} />
            <Route path="requests" element={<AdminRequests />} />
            <Route path="employees" element={<AdminEmployees />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}
