import { browserKind } from './geo';
import { isStandalone } from './push';

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

// Must run before React renders: Chrome fires this event once, early in page load.
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn());
  });
}

export const canOneTapInstall = () => deferred !== null;

export function onInstallChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function oneTapInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  listeners.forEach((fn) => fn());
  return outcome === 'accepted';
}

// KakaoTalk / Naver in-app browsers cannot install web apps; hand the page to the phone's real browser.
export function escapeInAppBrowser(): boolean {
  const kind = browserKind();
  if (kind !== 'kakao' || isStandalone()) return false;
  location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`;
  return true;
}
