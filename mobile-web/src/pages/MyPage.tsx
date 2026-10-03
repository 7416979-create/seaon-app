import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import { config } from '../config'
import { isIOS, isStandalone, useInstallPrompt } from '../services/install'
import { enablePush, pushSupport, showTestNotification } from '../services/push'

export default function MyPage() {
  const { session, logout } = useAuth()
  const user = session!.user
  const { canPrompt, install } = useInstallPrompt()
  const [pushMsg, setPushMsg] = useState('')

  const onEnablePush = async () => {
    const support = pushSupport()
    if (support === 'needs-install') return setPushMsg('iPhone에서는 먼저 홈 화면에 추가한 뒤 앱 아이콘으로 실행해야 알림을 받을 수 있습니다.')
    if (support === 'unsupported') return setPushMsg('이 브라우저는 알림을 지원하지 않습니다.')
    try {
      const { permission, subscription } = await enablePush()
      if (permission !== 'granted') return setPushMsg('알림 권한이 허용되지 않았습니다. 브라우저 설정에서 허용해 주세요.')
      await showTestNotification()
      setPushMsg(subscription || !config.vapidPublicKey ? '알림이 허용되었습니다.' : '알림 구독을 만들지 못했습니다.')
    } catch {
      setPushMsg('알림 설정 중 오류가 발생했습니다.')
    }
  }

  return (
    <>
      <PageHeader title="마이페이지" />
      <section className="card profile">
        <div className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</div>
        <div>
          <strong>{user.name}</strong>
          <p className="muted">
            {user.department} · {user.position}
          </p>
        </div>
      </section>

      <ul className="card list">
        <li><span className="muted">사원번호</span><span>{user.employeeNo}</span></li>
        <li><span className="muted">이메일</span><span>{user.email}</span></li>
        <li><span className="muted">소속</span><span>{user.department}</span></li>
      </ul>

      <section className="card">
        <h2>설정</h2>
        <div className="setting">
          <div>
            <strong>알림 받기</strong>
            <p className="muted">출퇴근 알림 등 푸시 알림</p>
          </div>
          <button className="btn small" onClick={onEnablePush}>설정</button>
        </div>
        {pushMsg && <p className="hint">{pushMsg}</p>}
        {!isStandalone() && (
          <div className="setting">
            <div>
              <strong>홈 화면에 추가</strong>
              <p className="muted">
                {canPrompt
                  ? '앱처럼 바로 실행할 수 있습니다.'
                  : isIOS()
                    ? 'Safari 하단 공유 버튼 → "홈 화면에 추가"'
                    : '브라우저 메뉴(⋮) → "홈 화면에 추가" 또는 "앱 설치"'}
              </p>
            </div>
            {canPrompt && <button className="btn small" onClick={install}>추가</button>}
          </div>
        )}
      </section>

      <button className="btn outline block" onClick={logout}>로그아웃</button>
      <p className="version">v{__APP_VERSION__}{config.mockMode ? ' · 테스트 모드' : ''}</p>
    </>
  )
}
