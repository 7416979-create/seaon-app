import { config } from '../config'

export type PushSupport = 'supported' | 'unsupported' | 'needs-install'

export function pushSupport(): PushSupport {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    // iOS Safari exposes Web Push only to web apps added to the Home Screen (iOS 16.4+).
    return /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'needs-install' : 'unsupported'
  }
  if (!('PushManager' in window)) return 'unsupported'
  return 'supported'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * Asks for notification permission and, if a VAPID public key is configured,
 * creates a push subscription. Sending it to the backend is done in the push step.
 */
export async function enablePush(): Promise<{ permission: NotificationPermission; subscription: PushSubscription | null }> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted' || !config.vapidPublicKey) return { permission, subscription: null }
  const reg = await navigator.serviceWorker.ready
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) }))
  return { permission, subscription }
}

/** Local test notification shown through the service worker (no server needed). */
export async function showTestNotification(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('세아온 근태관리', { body: '알림이 정상적으로 설정되었습니다.', icon: `${import.meta.env.BASE_URL}icons/icon-192.png` })
}
