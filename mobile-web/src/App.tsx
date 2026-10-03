import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import RequireAuth from './auth/RequireAuth'
import TabLayout from './components/TabLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import MyPage from './pages/MyPage'
import Records from './pages/Records'
import Requests from './pages/Requests'
import Splash from './pages/Splash'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<TabLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/records" element={<Records />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/mypage" element={<MyPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
