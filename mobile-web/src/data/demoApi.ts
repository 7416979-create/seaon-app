import type { Api, AttendanceRecord, LeaveBalance, LeaveRequest, User, Workplace } from './types';
import { todayKey } from '../lib/time';

// Demo mode: data lives only in this browser (localStorage). Demo login: see README.md.
const DEMO_USERS: Array<User & { password: string }> = [
  {
    id: 'u1001',
    empNo: '1001',
    name: '홍길동',
    email: 'demo@seaon.co.kr',
    dept: '경영지원팀',
    position: '사원',
    joinDate: '2025-03-02',
    password: '1234',
  },
];

const ANNUAL_LEAVE_DAYS = 15;
const SESSION_KEY = 'seaon.session';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function requireUser(): User {
  const u = read<User | null>(SESSION_KEY, null);
  if (!u) throw new Error('로그인이 필요합니다.');
  return u;
}

const k = (name: string) => `seaon.${requireUser().id}.${name}`;

function leaveDays(r: LeaveRequest): number {
  if (r.type === '연차') {
    const start = new Date(r.date);
    const end = new Date(r.endDate ?? r.date);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  }
  if (r.type === '오전반차' || r.type === '오후반차') return 0.5;
  return 0;
}

export const demoApi: Api = {
  async login(id, password) {
    await delay(500);
    const key = id.trim().toLowerCase();
    const found = DEMO_USERS.find((u) => u.empNo === key || u.email.toLowerCase() === key);
    if (!found || found.password !== password) throw new Error('사원번호(이메일) 또는 비밀번호가 올바르지 않습니다.');
    const { password: _pw, ...user } = found;
    void _pw;
    write(SESSION_KEY, user);
    return user;
  },

  async logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  currentUser() {
    return read<User | null>(SESSION_KEY, null);
  },

  async getWorkplace() {
    return read<Workplace | null>(k('workplace'), null);
  },

  async setWorkplace(wp) {
    write(k('workplace'), wp);
  },

  async getRecord(date) {
    const all = read<Record<string, AttendanceRecord>>(k('records'), {});
    return all[date] ?? null;
  },

  async checkIn(loc) {
    await delay();
    const all = read<Record<string, AttendanceRecord>>(k('records'), {});
    const date = todayKey();
    if (all[date]?.checkIn) throw new Error('이미 출근 처리되었습니다.');
    all[date] = { date, checkIn: new Date().toISOString(), inLoc: loc };
    write(k('records'), all);
    return all[date];
  },

  async checkOut(loc) {
    await delay();
    const all = read<Record<string, AttendanceRecord>>(k('records'), {});
    const date = todayKey();
    const rec = all[date];
    if (!rec?.checkIn) throw new Error('출근 기록이 없습니다. 먼저 출근해 주세요.');
    if (rec.checkOut) throw new Error('이미 퇴근 처리되었습니다.');
    rec.checkOut = new Date().toISOString();
    rec.outLoc = loc;
    write(k('records'), all);
    return rec;
  },

  async getRecords(month) {
    const all = read<Record<string, AttendanceRecord>>(k('records'), {});
    return Object.values(all)
      .filter((r) => r.date.startsWith(month))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async listRequests() {
    return read<LeaveRequest[]>(k('requests'), []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createRequest(req) {
    await delay();
    const list = read<LeaveRequest[]>(k('requests'), []);
    const item: LeaveRequest = {
      ...req,
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      status: '대기',
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    write(k('requests'), list);
    return item;
  },

  async cancelRequest(id) {
    const list = read<LeaveRequest[]>(k('requests'), []);
    const item = list.find((r) => r.id === id);
    if (item && item.status === '대기') item.status = '취소';
    write(k('requests'), list);
  },

  async leaveBalance(): Promise<LeaveBalance> {
    const list = read<LeaveRequest[]>(k('requests'), []);
    const used = list.filter((r) => r.status === '승인').reduce((s, r) => s + leaveDays(r), 0);
    const pending = list.filter((r) => r.status === '대기').reduce((s, r) => s + leaveDays(r), 0);
    return { total: ANNUAL_LEAVE_DAYS, used, pending };
  },
};

export const api: Api = demoApi;
export const IS_DEMO = true;
