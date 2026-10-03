import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, IS_DEMO } from '../data/demoApi';
import type { Workplace } from '../data/types';
import { browserKind, getPosition, GeoError, locationPermission, type GeoPermission } from '../lib/geo';
import { enableNotifications, isStandalone, pushSupport, showTestNotification } from '../lib/push';
import { LocationSheet } from '../components/LocationSheet';
import { useToast } from '../components/Toast';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PERM_LABEL: Record<GeoPermission, string> = {
  granted: '허용됨',
  denied: '거부됨',
  prompt: '확인 필요',
  unknown: '확인 필요',
  unsupported: '지원 안 함',
};

export default function MyPage() {
  const user = api.currentUser()!;
  const navigate = useNavigate();
  const toast = useToast();
  const [wp, setWp] = useState<Workplace>({ name: '본사', lat: 0, lng: 0, radius: 150 });
  const [wpSaved, setWpSaved] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [geoPerm, setGeoPerm] = useState<GeoPermission>('unknown');
  const [notif, setNotif] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported',
  );
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [deniedSheet, setDeniedSheet] = useState(false);
  const push = pushSupport();
  const kind = browserKind();

  useEffect(() => {
    api.getWorkplace().then((w) => {
      if (w) {
        setWp(w);
        setWpSaved(true);
      }
    });
    locationPermission().then(setGeoPerm);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function useCurrentLocation() {
    setLocBusy(true);
    try {
      const fix = await getPosition();
      setWp((w) => ({ ...w, lat: +fix.lat.toFixed(6), lng: +fix.lng.toFixed(6) }));
      setGeoPerm('granted');
      toast(`현재 위치를 불러왔습니다 (정확도 ±${Math.round(fix.accuracy)}m). 저장을 눌러 주세요.`);
    } catch (e) {
      if (e instanceof GeoError && e.code === 'denied') {
        setGeoPerm('denied');
        setDeniedSheet(true);
      } else toast((e as Error).message);
    } finally {
      setLocBusy(false);
    }
  }

  async function saveWorkplace() {
    if (!wp.name.trim()) return toast('사업장 이름을 입력해 주세요.');
    if (!wp.lat || !wp.lng) return toast('위치를 먼저 지정해 주세요.');
    if (wp.radius < 30 || wp.radius > 2000) return toast('반경은 30m ~ 2,000m 사이로 입력해 주세요.');
    await api.setWorkplace({ ...wp, name: wp.name.trim() });
    setWpSaved(true);
    toast('사업장 위치를 저장했습니다.');
  }

  async function turnOnNotifications() {
    const p = await enableNotifications();
    setNotif(p);
    toast(p === 'granted' ? '알림이 켜졌습니다.' : '알림 권한이 허용되지 않았습니다.');
  }

  async function install() {
    if (!installEvt) return;
    await installEvt.prompt();
    setInstallEvt(null);
  }

  async function logout() {
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
          <div className="list-item"><span className="muted">이메일</span><span>{user.email}</span></div>
          <div className="list-item"><span className="muted">소속</span><span>{user.dept}</span></div>
          <div className="list-item"><span className="muted">입사일</span><span>{user.joinDate}</span></div>
        </div>
      </section>

      <section className="card stack" aria-label="사업장 위치 설정">
        <div className="row">
          <h3 style={{ margin: 0 }}>사업장 위치</h3>
          <span className={`chip ${wpSaved ? 'chip-ok' : 'chip-warn'}`}>{wpSaved ? '설정됨' : '미설정'}</span>
        </div>
        <div className="field">
          <label htmlFor="wp-name">사업장 이름</label>
          <input id="wp-name" className="input" value={wp.name} onChange={(e) => setWp({ ...wp, name: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field">
            <label htmlFor="wp-lat">위도</label>
            <input id="wp-lat" className="input" inputMode="decimal" value={wp.lat || ''} onChange={(e) => setWp({ ...wp, lat: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor="wp-lng">경도</label>
            <input id="wp-lng" className="input" inputMode="decimal" value={wp.lng || ''} onChange={(e) => setWp({ ...wp, lng: Number(e.target.value) })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="wp-radius">허용 반경 (m)</label>
          <input id="wp-radius" className="input" type="number" inputMode="numeric" min={30} max={2000} value={wp.radius} onChange={(e) => setWp({ ...wp, radius: Number(e.target.value) })} />
        </div>
        <button className="btn btn-outline btn-block" onClick={useCurrentLocation} disabled={locBusy}>
          {locBusy ? '위치 확인 중…' : '📍 지금 있는 곳을 사업장으로 지정'}
        </button>
        <button className="btn btn-primary btn-block" onClick={saveWorkplace}>저장</button>
        {IS_DEMO && <div className="muted small">테스트 버전에서는 직접 설정합니다. 정식 버전에서는 관리자가 회사 위치를 등록합니다.</div>}
      </section>

      <section className="card" aria-label="권한 및 알림">
        <h3>권한 · 알림</h3>
        <div className="list">
          <div className="list-item">
            <span>위치 권한</span>
            <span className={`chip ${geoPerm === 'granted' ? 'chip-ok' : geoPerm === 'denied' ? 'chip-danger' : ''}`}>{PERM_LABEL[geoPerm]}</span>
          </div>
          <div className="list-item">
            <span>알림</span>
            {push === 'needs-install' ? (
              <span className="chip chip-warn">홈 화면 추가 필요</span>
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
        </div>
        {push === 'needs-install' && (
          <div className="notice notice-info small" style={{ marginTop: 8 }}>
            아이폰은 홈 화면에 추가한 뒤 그 아이콘으로 열어야 알림을 받을 수 있습니다. (iOS 16.4 이상)
          </div>
        )}
      </section>

      {!isStandalone() && (
        <section className="card stack" aria-label="홈 화면에 추가">
          <h3 style={{ margin: 0 }}>홈 화면에 추가</h3>
          {installEvt ? (
            <button className="btn btn-primary btn-block" onClick={install}>앱처럼 설치하기</button>
          ) : kind.startsWith('ios') ? (
            <div className="small muted">Safari 아래쪽 <b>공유 버튼(□↑)</b> → <b>"홈 화면에 추가"</b>를 누르세요.</div>
          ) : kind === 'samsung' ? (
            <div className="small muted">아래쪽 메뉴(≡) → <b>"현재 페이지 추가"</b> → <b>"홈 화면"</b>을 누르세요.</div>
          ) : (
            <div className="small muted">브라우저 메뉴(⋮) → <b>"홈 화면에 추가"</b> 또는 <b>"앱 설치"</b>를 누르세요.</div>
          )}
        </section>
      )}

      <section className="card" aria-label="앱 정보">
        <div className="list">
          <div className="list-item"><span className="muted">버전</span><span>0.1.0{IS_DEMO ? ' (테스트)' : ''}</span></div>
        </div>
      </section>

      <button className="btn btn-danger btn-block" onClick={logout}>로그아웃</button>

      {deniedSheet && <LocationSheet mode="denied" onClose={() => setDeniedSheet(false)} />}
    </div>
  );
}
