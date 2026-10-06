import { useEffect, useState } from 'react';
import { browserKind } from '../lib/geo';
import { canOneTapInstall, oneTapInstall, onInstallChange } from '../lib/install';
import { isStandalone } from '../lib/push';

const DISMISS_KEY = 'seaon.installDismissed';

export function InstallBanner() {
  const [canInstall, setCanInstall] = useState(canOneTapInstall());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const off = onInstallChange(() => setCanInstall(canOneTapInstall()));
    return () => {
      off();
    };
  }, []);

  if (isStandalone() || dismissed) return null;
  const kind = browserKind();

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }

  return (
    <div className="install-banner" role="region" aria-label="홈 화면에 설치">
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>홈 화면에 근태웹 설치</b>
        <div className="small">
          {canInstall
            ? '버튼 한 번이면 앱처럼 설치됩니다. (스토어·파일 다운로드 없음)'
            : kind.startsWith('ios')
              ? 'Safari 아래쪽 공유(□↑) → "홈 화면에 추가"를 누르세요.'
              : kind === 'kakao' || kind === 'naver'
                ? '메뉴 → "다른 브라우저로 열기"를 누른 뒤 설치하세요.'
                : kind === 'samsung'
                  ? '아래 메뉴(≡) → "현재 페이지 추가" → "홈 화면"을 누르세요.'
                  : '브라우저 메뉴(⋮) → "앱 설치" 또는 "홈 화면에 추가"를 누르세요.'}
        </div>
      </div>
      {canInstall && (
        <button className="btn btn-sm btn-primary" onClick={() => oneTapInstall()}>
          설치
        </button>
      )}
      <button className="install-close" onClick={dismiss} aria-label="닫기">
        ×
      </button>
    </div>
  );
}
