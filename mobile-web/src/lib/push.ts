import { browserKind } from './geo';

// Set VITE_VAPID_PUBLIC_KEY once a push server exists; until then only local test notifications work.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushSupport = 'supported' | 'needs-install' | 'unsupported';

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupport(): PushSupport {
  const hasApis = 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
  // iOS only exposes web push to apps added to the home screen (iOS 16.4+).
  if (browserKind().startsWith('ios') && !isStandalone()) return 'needs-install';
  return hasApis ? 'supported' : 'unsupported';
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({ immediate: true });
  return navigator.serviceWorker.ready;
}

export async function enableNotifications(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  const permission = await Notification.requestPermission();
  if (permission === 'granted' && VAPID_PUBLIC_KEY) {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    // TODO(server): POST sub.toJSON() to the push server so it can send notifications to this device.
    console.info('push subscription', sub.toJSON());
  }
  return permission;
}

export async function showTestNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('근태관리 알림 테스트', {
    body: '알림이 정상적으로 동작합니다.',
    icon: 'icons/icon-192.png',
  });
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
