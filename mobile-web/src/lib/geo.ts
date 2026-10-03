export type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown';

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
}

export class GeoError extends Error {
  constructor(
    public code: 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure',
    message: string,
  ) {
    super(message);
  }
}

export async function locationPermission(): Promise<GeoPermission> {
  if (!('geolocation' in navigator)) return 'unsupported';
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return (status?.state as GeoPermission) ?? 'unknown';
  } catch {
    // Safari before 16 has no Permissions API for geolocation.
    return 'unknown';
  }
}

export function getPosition(): Promise<Fix> {
  if (!window.isSecureContext) {
    return Promise.reject(new GeoError('insecure', '보안 연결(https)에서만 위치를 확인할 수 있습니다.'));
  }
  if (!('geolocation' in navigator)) {
    return Promise.reject(new GeoError('unsupported', '이 브라우저는 위치 기능을 지원하지 않습니다.'));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => {
        if (e.code === e.PERMISSION_DENIED) reject(new GeoError('denied', '위치 권한이 거부되었습니다.'));
        else if (e.code === e.TIMEOUT) reject(new GeoError('timeout', '위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.'));
        else reject(new GeoError('unavailable', '현재 위치를 확인할 수 없습니다. GPS(위치 서비스)가 켜져 있는지 확인해 주세요.'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

// Haversine distance in meters.
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type BrowserKind = 'ios-safari' | 'ios-other' | 'samsung' | 'android-chrome' | 'kakao' | 'naver' | 'desktop' | 'other';

export function browserKind(): BrowserKind {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/NAVER\(inapp/i.test(ua)) return 'naver';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Android/i.test(ua)) return 'android-chrome';
  if (!/Mobi/i.test(ua)) return 'desktop';
  return 'other';
}

export function deniedHelp(kind: BrowserKind): string[] {
  switch (kind) {
    case 'ios-safari':
      return [
        '아이폰 설정 → 개인정보 보호 및 보안 → 위치 서비스가 켜져 있는지 확인',
        '설정 → Safari → 위치 → "묻기" 또는 "허용" 선택',
        '이 페이지로 돌아와 새로고침 후 다시 시도',
      ];
    case 'ios-other':
      return ['아이폰 설정 → 사용 중인 브라우저 앱 → 위치 → "앱을 사용하는 동안" 선택', '이 페이지로 돌아와 새로고침 후 다시 시도'];
    case 'samsung':
      return [
        '주소창 왼쪽 자물쇠 아이콘 → 권한 → 위치 → 허용',
        '휴대폰 설정 → 애플리케이션 → 삼성 인터넷 → 권한 → 위치 → 허용',
        '새로고침 후 다시 시도',
      ];
    case 'android-chrome':
      return [
        '주소창 왼쪽 아이콘(자물쇠/설정) → 권한 → 위치 → 허용',
        '휴대폰 설정 → 애플리케이션 → Chrome → 권한 → 위치 → 허용',
        '새로고침 후 다시 시도',
      ];
    case 'kakao':
    case 'naver':
      return [
        '앱 내부 브라우저에서는 위치 확인이 제한될 수 있습니다.',
        '오른쪽 위 메뉴(⋮ 또는 공유) → "다른 브라우저로 열기"를 눌러 Chrome·Safari·삼성 인터넷에서 열어 주세요.',
      ];
    default:
      return ['브라우저 주소창의 사이트 설정에서 위치 권한을 "허용"으로 바꾼 뒤 새로고침해 주세요.'];
  }
}
