import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { api } from './data/demoApi';
import { TabBar } from './components/TabBar';
import { ToastProvider } from './components/Toast';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Home from './pages/Home';
import Records from './pages/Records';
import Leave from './pages/Leave';
import MyPage from './pages/MyPage';

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
        <div className="app">
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route path="/home" element={<Home />} />
              <Route path="/records" element={<Records />} />
              <Route path="/leave" element={<Leave />} />
              <Route path="/my" element={<MyPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </HashRouter>
    </ToastProvider>
  );
}
