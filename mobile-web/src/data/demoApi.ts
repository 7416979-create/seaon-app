import type {
  Admin,
  AdminApi,
  Api,
  AttendanceRecord,
  DayRow,
  Employee,
  LeaveBalance,
  LeaveRequest,
  User,
  Workplace,
} from './types';
import { dateKey, todayKey } from '../lib/time';

// Demo mode: one shared store in this browser's localStorage, used by both the employee
// app and the admin console. Demo logins are listed in README.md.

type StoredEmployee = Employee & { password: string };

interface Db {
  version: 2;
  employees: StoredEmployee[];
  records: Record<string, Record<string, AttendanceRecord>>; // empId -> date -> record
  requests: LeaveRequest[];
  workplace: Workplace | null;
}

const DB_KEY = 'seaon.db.v2';
const SESSION_KEY = 'seaon.session';
const ADMIN_SESSION_KEY = 'seaon.adminSession';
const ADMINS = [{ id: 'admin', name: '관리자', password: 'admin1234' }];

const SAMPLE: Array<Omit<StoredEmployee, 'active' | 'annualLeave'>> = [
  { id: 'u1001', empNo: '1001', name: '홍길동', email: 'demo@seaon.co.kr', dept: '경영지원팀', position: '사원', joinDate: '2025-03-02', password: '1234' },
  { id: 'u1002', empNo: '1002', name: '김민지', email: 'minji@seaon.co.kr', dept: '영업팀', position: '대리', joinDate: '2023-07-10', password: '1234' },
  { id: 'u1003', empNo: '1003', name: '이준호', email: 'junho@seaon.co.kr', dept: '생산팀', position: '과장', joinDate: '2021-01-04', password: '1234' },
  { id: 'u1004', empNo: '1004', name: '박서연', email: 'seoyeon@seaon.co.kr', dept: '영업팀', position: '사원', joinDate: '2025-09-01', password: '1234' },
  { id: 'u1005', empNo: '1005', name: '최우진', email: 'woojin@seaon.co.kr', dept: '생산팀', position: '주임', joinDate: '2022-05-16', password: '1234' },
];

// Small deterministic hash so sample data looks the same on every load.
function rand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function at(date: string, h: number, m: number): string {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
}

function seed(): Db {
  const employees: StoredEmployee[] = SAMPLE.map((e) => ({ ...e, active: true, annualLeave: 15 }));
  const records: Db['records'] = {};
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  for (const e of employees) {
    if (e.id === 'u1001') continue; // the demo login starts with a clean history
    records[e.id] = {};
    for (let d = new Date(first); d < new Date(today.getFullYear(), today.getMonth(), today.getDate()); d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const key = dateKey(d);
      const r = rand(e.id + key);
      if (r < 0.06) continue; // absent / on leave
      const inMin = 8 * 60 + 35 + Math.floor(r * 40); // 08:35 ~ 09:15
      const outMin = 18 * 60 + Math.floor(rand(key + e.id) * 90); // 18:00 ~ 19:30
      records[e.id][key] = {
        date: key,
        checkIn: at(key, Math.floor(inMin / 60), inMin % 60),
        checkOut: at(key, Math.floor(outMin / 60), outMin % 60),
      };
    }
  }
  const tk = todayKey();
  if (today.getDay() !== 0 && today.getDay() !== 6) {
    records.u1002[tk] = { date: tk, checkIn: at(tk, 8, 51) };
    records.u1003[tk] = { date: tk, checkIn: at(tk, 9, 12) };
  }
  const requests: LeaveRequest[] = [
    {
      id: 'r-sample-1', empId: 'u1004', empName: '박서연', type: '연차',
      date: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)),
      endDate: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)),
      reason: '개인 사유', status: '대기', createdAt: new Date().toISOString(),
    },
    {
      id: 'r-sample-2', empId: 'u1005', empName: '최우진', type: '조퇴',
      date: tk, time: '16:00', reason: '병원 진료', status: '대기', createdAt: new Date().toISOString(),
    },
  ];
  return { version: 2, employees, records, requests, workplace: null };
}

function load(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    // fall through to a fresh seed
  }
  const db = seed();
  save(db);
  return db;
}

function save(db: Db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function readSession<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function publicUser(e: StoredEmployee): User {
  const { id, empNo, name, email, dept, position, joinDate } = e;
  return { id, empNo, name, email, dept, position, joinDate };
}

function publicEmployee(e: StoredEmployee): Employee {
  const { password: _pw, ...rest } = e;
  void _pw;
  return rest;
}

function requireUser(): User {
  const u = readSession<User>(SESSION_KEY);
  if (!u) throw new Error('로그인이 필요합니다.');
  return u;
}

function requireAdmin() {
  if (!readSession<Admin>(ADMIN_SESSION_KEY)) throw new Error('관리자 로그인이 필요합니다.');
}

function leaveDays(r: LeaveRequest): number {
  if (r.type === '연차') {
    const start = new Date(r.date);
    const end = new Date(r.endDate ?? r.date);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  }
  if (r.type === '오전반차' || r.type === '오후반차') return 0.5;
  return 0;
}

function balanceOf(db: Db, empId: string): LeaveBalance {
  const emp = db.employees.find((e) => e.id === empId);
  const mine = db.requests.filter((r) => r.empId === empId);
  return {
    total: emp?.annualLeave ?? 15,
    used: mine.filter((r) => r.status === '승인').reduce((s, r) => s + leaveDays(r), 0),
    pending: mine.filter((r) => r.status === '대기').reduce((s, r) => s + leaveDays(r), 0),
  };
}

export const demoApi: Api = {
  async login(id, password) {
    await delay(500);
    const key = id.trim().toLowerCase();
    const found = load().employees.find((u) => u.active && (u.empNo === key || u.email.toLowerCase() === key));
    if (!found || found.password !== password) throw new Error('사원번호(이메일) 또는 비밀번호가 올바르지 않습니다.');
    const user = publicUser(found);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  },

  async logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  currentUser() {
    return readSession<User>(SESSION_KEY);
  },

  async getWorkplace() {
    return load().workplace;
  },

  async setWorkplace(wp) {
    const db = load();
    db.workplace = wp;
    save(db);
  },

  async getRecord(date) {
    return load().records[requireUser().id]?.[date] ?? null;
  },

  async checkIn(loc) {
    await delay();
    const me = requireUser();
    const db = load();
    const date = todayKey();
    const mine = (db.records[me.id] ??= {});
    if (mine[date]?.checkIn) throw new Error('이미 출근 처리되었습니다.');
    mine[date] = { date, checkIn: new Date().toISOString(), inLoc: loc };
    save(db);
    return mine[date];
  },

  async checkOut(loc) {
    await delay();
    const me = requireUser();
    const db = load();
    const rec = db.records[me.id]?.[todayKey()];
    if (!rec?.checkIn) throw new Error('출근 기록이 없습니다. 먼저 출근해 주세요.');
    if (rec.checkOut) throw new Error('이미 퇴근 처리되었습니다.');
    rec.checkOut = new Date().toISOString();
    rec.outLoc = loc;
    save(db);
    return rec;
  },

  async getRecords(month) {
    const mine = load().records[requireUser().id] ?? {};
    return Object.values(mine)
      .filter((r) => r.date.startsWith(month))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async listRequests() {
    const me = requireUser();
    return load()
      .requests.filter((r) => r.empId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createRequest(req) {
    await delay();
    const me = requireUser();
    const db = load();
    const item: LeaveRequest = { ...req, id: uid(), empId: me.id, empName: me.name, status: '대기', createdAt: new Date().toISOString() };
    db.requests.push(item);
    save(db);
    return item;
  },

  async cancelRequest(id) {
    const me = requireUser();
    const db = load();
    const item = db.requests.find((r) => r.id === id && r.empId === me.id);
    if (item && item.status === '대기') item.status = '취소';
    save(db);
  },

  async leaveBalance() {
    return balanceOf(load(), requireUser().id);
  },
};

export const adminApi: AdminApi = {
  async login(id, password) {
    await delay(400);
    const found = ADMINS.find((a) => a.id === id.trim().toLowerCase());
    if (!found || found.password !== password) throw new Error('관리자 아이디 또는 비밀번호가 올바르지 않습니다.');
    const admin: Admin = { id: found.id, name: found.name };
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin));
    load();
    return admin;
  },

  async logout() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  },

  currentAdmin() {
    return readSession<Admin>(ADMIN_SESSION_KEY);
  },

  async listEmployees() {
    requireAdmin();
    return load().employees.map(publicEmployee);
  },

  async createEmployee(e) {
    requireAdmin();
    const db = load();
    if (db.employees.some((x) => x.empNo === e.empNo)) throw new Error('이미 사용 중인 사원번호입니다.');
    if (db.employees.some((x) => x.email.toLowerCase() === e.email.toLowerCase())) throw new Error('이미 사용 중인 이메일입니다.');
    const created: StoredEmployee = { ...e, id: `u${e.empNo}-${Date.now().toString(36)}`, active: true };
    db.employees.push(created);
    save(db);
    return publicEmployee(created);
  },

  async updateEmployee(id, patch) {
    requireAdmin();
    const db = load();
    const emp = db.employees.find((x) => x.id === id);
    if (!emp) throw new Error('직원을 찾을 수 없습니다.');
    Object.assign(emp, patch);
    save(db);
  },

  async resetPassword(id, password) {
    requireAdmin();
    const db = load();
    const emp = db.employees.find((x) => x.id === id);
    if (!emp) throw new Error('직원을 찾을 수 없습니다.');
    emp.password = password;
    save(db);
  },

  async dayStatus(date): Promise<DayRow[]> {
    requireAdmin();
    const db = load();
    return db.employees
      .filter((e) => e.active)
      .map((e) => ({
        employee: publicEmployee(e),
        record: db.records[e.id]?.[date] ?? null,
        leave:
          db.requests.find(
            (r) => r.empId === e.id && r.status === '승인' && r.date <= date && (r.endDate ?? r.date) >= date,
          ) ?? null,
      }));
  },

  async records(from, to, empId) {
    requireAdmin();
    const db = load();
    const out: Array<AttendanceRecord & { empId: string }> = [];
    for (const [id, byDate] of Object.entries(db.records)) {
      if (empId && id !== empId) continue;
      for (const r of Object.values(byDate)) if (r.date >= from && r.date <= to) out.push({ ...r, empId: id });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date) || a.empId.localeCompare(b.empId));
  },

  async listRequests(status) {
    requireAdmin();
    return load()
      .requests.filter((r) => !status || r.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async decideRequest(id, status, note) {
    requireAdmin();
    const db = load();
    const r = db.requests.find((x) => x.id === id);
    if (!r) throw new Error('신청을 찾을 수 없습니다.');
    if (r.status !== '대기') throw new Error('이미 처리된 신청입니다.');
    r.status = status;
    r.decidedAt = new Date().toISOString();
    if (note) r.decisionNote = note;
    save(db);
  },

  async leaveBalanceOf(empId) {
    requireAdmin();
    return balanceOf(load(), empId);
  },

  async getWorkplace() {
    return load().workplace;
  },

  async setWorkplace(wp) {
    requireAdmin();
    const db = load();
    db.workplace = wp;
    save(db);
  },
};

export const api: Api = demoApi;
export const IS_DEMO = true;
