// Monthly attendance summary for the admin records screen (5차 L6, moved here in 6차 M4).
// Pure functions: no React, no API calls, so the rules can be checked without a browser.
import type { AttendanceRecord, Employee, Holiday, LeaveRequest } from '../data/types';
import { dateKey, isLate, workedMinutes } from './time';

export interface SummaryRow {
  workDays: number;
  days: number;
  late: number;
  leave: number;
  absent: number;
  minutes: number;
}

export type MonthlyRow = AttendanceRecord & { empId: string };

// Every date from a to b (YYYY-MM-DD), inclusive.
export function daysBetween(a: string, b: string): string[] {
  const out: string[] = [];
  const [y, m, d] = a.split('-').map(Number);
  const [ey, em, ed] = b.split('-').map(Number);
  const end = new Date(ey, em - 1, ed);
  for (let t = new Date(y, m - 1, d); t <= end; t.setDate(t.getDate() + 1)) out.push(dateKey(t));
  return out;
}

// Working days: weekdays that are not public holidays, up to the end date (never future days).
export function workingDays(from: string, to: string, holidays: Holiday[]): Set<string> {
  const off = new Set(holidays.map((h) => h.date));
  const set = new Set<string>();
  for (const day of daysBetween(from, to)) {
    const [y, m, d] = day.split('-').map(Number);
    const w = new Date(y, m - 1, d).getDay();
    if (w !== 0 && w !== 6 && !off.has(day)) set.add(day);
  }
  return set;
}

// Leave days of one approved request inside the working days. 연차 = 1 per day, 반차 = 0.5, 외출·조퇴 = 0.
export function leaveDaysOf(r: LeaveRequest, working: Set<string>): number {
  if (r.type !== '연차' && r.type !== '오전반차' && r.type !== '오후반차') return 0;
  const per = r.type === '연차' ? 1 : 0.5;
  return daysBetween(r.date, r.endDate ?? r.date).filter((d) => working.has(d)).length * per;
}

// Per employee: 근무일수, 출근일수, 지각, 휴가, 결근, 총 근무시간.
// 결근 = 근무일수 - 출근일수 - 휴가 (0 미만이면 0). Holidays and future days are not counted.
// Every active employee gets a row, even with no records; days before the join date are not counted.
export function monthlySummary(input: {
  from: string;
  to: string;
  today: Date;
  holidays: Holiday[];
  employees: Employee[];
  empId: string;
  rows: MonthlyRow[];
  approved: LeaveRequest[];
  workStart: string;
}): Map<string, SummaryRow> {
  const { from, to, today, holidays, employees, empId, rows, approved, workStart } = input;
  const todayKeyStr = dateKey(today);
  const working = workingDays(from, to > todayKeyStr ? todayKeyStr : to, holidays);
  const byId = new Map(employees.map((e) => [e.id, e]));
  const m = new Map<string, SummaryRow & { working: Set<string> }>();
  const entry = (id: string) => {
    let s = m.get(id);
    if (!s) {
      const join = byId.get(id)?.joinDate ?? '';
      const mine = new Set([...working].filter((d) => d >= join));
      s = { working: mine, workDays: mine.size, days: 0, late: 0, leave: 0, absent: 0, minutes: 0 };
      m.set(id, s);
    }
    return s;
  };
  for (const e of employees) if (e.active && (!empId || e.id === empId)) entry(e.id);
  for (const r of rows) {
    const s = entry(r.empId);
    if (r.checkIn && s.working.has(r.date)) {
      s.days += 1;
      if (isLate(r.checkIn, workStart)) s.late += 1;
    }
    s.minutes += workedMinutes(r.checkIn, r.checkOut);
  }
  for (const lr of approved) {
    const s = m.get(lr.empId);
    if (s) s.leave += leaveDaysOf(lr, s.working);
  }
  for (const s of m.values()) s.absent = Math.max(0, s.workDays - s.days - s.leave);
  return new Map([...m].map(([id, s]) => [id, { workDays: s.workDays, days: s.days, late: s.late, leave: s.leave, absent: s.absent, minutes: s.minutes }]));
}
