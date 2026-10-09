import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, IS_DEMO } from '../data';
import { browserKind } from '../lib/geo';
import { canOneTapInstall, oneTapInstall, onInstallChange } from '../lib/install';
import { enableNotifications, isStandalone, pushSupport, showTestNotification } from '../lib/push';
import { getLargeText, setLargeText } from '../lib/textSize';
import { useToast } from '../components/Toast';

export default function MyPage() {
  const user = api.currentUser()!;
  const navigate = useNavigate();
  const toast = useToast();
  const [notif, setNotif] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported',
  );
  const [canInstall, setCanInstall] = useState(canOneTapInstall());
  const [largeText, setLargeTextState] = useState(getLargeText());
  const push = pushSupport();
  const kind = browserKind();

  useEffect(() => {
    const off = onInstallChange(() => setCanInstall(canOneTapInstall()));
    return () => {
      off();
    };
  }, []);

  async function turnOnNotifications() {
    const p = await enableNotifications();
    setNotif(p);
    toast(p === 'granted' ? '알림이 켜졌습니다.' : '알림 권한이 허용되지 않았습니다.');
  }

  async function leave() {
    if (!window.confirm('이 휴대폰에서 접속을 해제할까요? 다시 쓰려면 개인 링크를 다시 눌러야 합니다.')) return;
    await api.logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="page">
      <div className="page-title">마이페이지</div>

      <section className="card" aria-label="프로필">
        <div className="row" style={{ justifyContent: 'flex-start', gap: 14 }}>
          <div className="logo" style={{ width: 56, height: 56, borderRadius: 28, fontSize: 22, fontWeight: 800, color: '#fff' }}>
            {user.name.slice(0, 1)}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{user.name}</div>
            <div className="muted small">{user.dept} · {user.position}</div>
          </div>
        </div>
        <div className="list" style={{ marginTop: 8 }}>
          <div className="list-item"><span className="muted">사원번호</span><span>{user.empNo}</span></div>
          {user.email && <div className="list-item"><span className="muted">이메일</span><span>{user.email}</span></div>}
          <div className="list-item"><span className="muted">소속</span><span>{user.dept}</span></div>
          <div className="list-item"><span className="muted">입사일</span><span>{user.joinDate}</span></div>
        </div>
      </section>

      <section className="card" aria-label="화면 설정">
        <div className="switch-row">
          <div>
            <b>큰 글씨로 보기</b>
            <div className="muted small">글자와 버튼을 크게 보여 줍니다. 이 휴대폰에만 저장됩니다.</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={largeText} onChange={(e) => { setLargeText(e.target.checked); setLargeTextState(e.target.checked); }} />
            <span />
          </label>
        </div>
      </section>

      <section className="card" aria-label="알림">
        <div className="row">
          <h3 style={{ margin: 0 }}>알림</h3>
          {push === 'needs-install' ? (
            <span className="chip chip-warn">홈 화면 설치 필요</span>
          ) : notif === 'granted' ? (
            <button className="btn btn-sm btn-outline" onClick={() => showTestNotification()}>테스트 알림</button>
          ) : notif === 'denied' ? (
            <span className="chip chip-danger">차단됨</span>
          ) : push === 'unsupported' || notif === 'unsupported' ? (
            <span className="chip">지원 안 함</span>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={turnOnNotifications}>알림 켜기</button>
          )}
        </div>
        {push === 'needs-install' && (
          <div className="muted small" style={{ marginTop: 8 }}>아이폰은 홈 화면에 설치한 뒤 그 아이콘으로 열어야 알림을 받을 수 있습니다.</div>
        )}
      </section>

      {!isStandalone() && (
        <section className="card stack" aria-label="홈 화면에 설치">
          <h3 style={{ margin: 0 }}>홈 화면에 설치</h3>
          {canInstall ? (
            <button className="btn btn-primary btn-block" onClick={() => oneTapInstall()}>설치하기 (한 번 누르면 끝)</button>
          ) : kind.startsWith('ios') ? (
            <div className="small muted">Safari 아래쪽 <b>공유 버튼(□↑)</b> → <b>"홈 화면에 추가"</b>를 누르세요.</div>
          ) : kind === 'samsung' ? (
            <div className="small muted">아래쪽 메뉴(≡) → <b>"현재 페이지 추가"</b> → <b>"홈 화면"</b>을 누르세요.</div>
          ) : (
            <div className="small muted">브라우저 메뉴(⋮) → <b>"앱 설치"</b> 또는 <b>"홈 화면에 추가"</b>를 누르세요.</div>
          )}
        </section>
      )}

      <section className="card" aria-label="정보">
        <div className="list">
          <div className="list-item"><span className="muted">버전</span><span>0.2.0{IS_DEMO ? ' (테스트)' : ''}</span></div>
        </div>
      </section>

      <button className="btn btn-sm btn-outline" style={{ alignSelf: 'center' }} onClick={leave}>이 휴대폰에서 접속 해제</button>
    </div>
  );
}
