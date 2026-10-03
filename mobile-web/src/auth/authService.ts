import { config } from '../config'
import { readJson, remove, writeJson } from '../services/storage'

export interface User {
  employeeNo: string
  name: string
  email: string
  department: string
  position: string
}

export interface Session {
  user: User
  /** Opaque token from the backend. Mock mode uses a random value. */
  token: string
}

const SESSION_KEY = 'seaon.session'

export function loadSession(): Session | null {
  return readJson<Session | null>(SESSION_KEY, null)
}

export async function login(id: string, password: string): Promise<Session> {
  const loginId = id.trim()
  if (!loginId || !password) throw new Error('사원번호(또는 이메일)와 비밀번호를 입력해 주세요.')

  let session: Session
  if (config.mockMode) {
    // Test mode: any ID with a 4+ character password signs in. Replace with the real API.
    if (password.length < 4) throw new Error('비밀번호는 4자 이상 입력해 주세요.')
    await new Promise((r) => setTimeout(r, 400))
    const isEmail = loginId.includes('@')
    session = {
      token: crypto.randomUUID(),
      user: {
        employeeNo: isEmail ? '100001' : loginId,
        name: '테스트 사용자',
        email: isEmail ? loginId : `${loginId}@example.com`,
        department: '경영지원팀',
        position: '사원',
      },
    }
  } else {
    const res = await fetch(`${config.apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: loginId, password }),
    })
    if (!res.ok) throw new Error('로그인에 실패했습니다. 계정 정보를 확인해 주세요.')
    session = (await res.json()) as Session
  }

  writeJson(SESSION_KEY, session)
  return session
}

export function logout(): void {
  remove(SESSION_KEY)
}
