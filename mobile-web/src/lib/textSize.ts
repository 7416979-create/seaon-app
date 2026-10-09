// Large-text mode for employee screens (5차 L7). Stored on this device only.
const KEY = 'seaon.largeText';

export function getLargeText(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setLargeText(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
  applyLargeText(on);
}

// Adds or removes the class on <html>. Styles for it live in styles.css under .large-text.
export function applyLargeText(on: boolean = getLargeText()) {
  document.documentElement.classList.toggle('large-text', on);
}
