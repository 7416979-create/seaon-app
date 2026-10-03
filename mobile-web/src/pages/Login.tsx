import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { config } from '../config'

export default function Login() {
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/home'
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/home" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(id, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-brand">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={64} height={64} />
        <h1>세아온 근태관리</h1>
        <p>사원번호 또는 이메일로 로그인하세요.</p>
      </div>
      <form className="card login-form" onSubmit={onSubmit} noValidate>
        <label>
          사원번호 / 이메일
          <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" placeholder="사원번호 또는 이메일" />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="비밀번호" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
        {config.mockMode && <p className="hint">테스트 모드: 아무 사원번호와 4자 이상 비밀번호로 로그인됩니다.</p>}
      </form>
    </div>
  )
}
