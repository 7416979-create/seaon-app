import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Splash() {
  const { session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate(session ? '/home' : '/login', { replace: true }), 900)
    return () => clearTimeout(t)
  }, [session, navigate])

  return (
    <div className="splash">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={88} height={88} />
      <h1>세아온 근태관리</h1>
      <div className="spinner" aria-label="로딩 중" />
    </div>
  )
}
