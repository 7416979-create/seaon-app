const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayKey = () => dateKey(new Date());

export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function hhmm(iso?: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function workedMinutes(checkIn?: string, checkOut?: string, now = new Date()): number {
  if (!checkIn) return 0;
  const end = checkOut ? new Date(checkOut) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(checkIn).getTime()) / 60000));
}

export const DEFAULT_WORK_START = '09:00';

// Late means checking in after the company's work-start time ('HH:MM').
export function isLate(iso?: string, workStart = DEFAULT_WORK_START): boolean {
  if (!iso) return false;
  const [h, m] = workStart.split(':').map(Number);
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() > h * 60 + m;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function koreanDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

export function weekdayOf(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

export function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (s.getDay() + 6) % 7;
  s.setDate(s.getDate() - diff);
  return s;
}
