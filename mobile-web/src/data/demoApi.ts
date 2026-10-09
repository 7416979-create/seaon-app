import type {
  Admin,
  AdminApi,
  Api,
  AttendanceRecord,
  DayRow,
  Employee,
  LeaveBalance,
  LeaveRequest,
  Policy,
  User,
} from './types';
import { dateKey, todayKey } from '../lib/time';

// Demo mode: one shared store in this browser's localStorage, used by both the employee
// screens and the admin console. A real server must enforce one-time admin links and
// device binding; here they are only enforced inside a single browser.

interface Db {
  version: 5;
  employees: Employee[];
  records: Record<string, Record<string, AttendanceRecord>>; // empId -> date -> record
  requests: LeaveRequest[];
  policy: Policy;
  adminLinks: Array<{ token: string; used: boolean }>;
}

const DB_KEY = 'seaon.db.v5';
const SESSION_KEY = 'seaon.session';
const ADMIN_SESSION_KEY = 'seaon.adminSession';
const ADMIN = { id: 'admin', name: '관리자', password: 'admin1234' };

// Fixed demo tokens so the same test links work on any device.
export const DEMO_ADMIN_TOKEN = 'a7s2e9o4n1';
const SAMPLE: Array<Omit<Employee, 'active' | 'annualLeave'>> = [
  { id: 'u1001', empNo: '1001', name: '홍길동', email: 'demo@seaon.co.kr', dept: '경영지원팀', position: '사원', joinDate: '2025-03-02', linkToken: 'q7k2m9a1' },
  { id: 'u1002', empNo: '1002', name: '김민지', email: 'minji@seaon.co.kr', dept: '영업팀', position: '대리', joinDate: '2023-07-10', linkToken: 'v3n8c5d2' },
  { id: 'u1003', empNo: '1003', name: '이준호', email: 'junho@seaon.co.kr', dept: '생산팀', position: '과장', joinDate: '2021-01-04', linkToken: 'x9p4t6b3' },
  { id: 'u1004', empNo: '1004', name: '박서연', email: 'seoyeon@seaon.co.kr', dept: '영업팀', position: '사원', joinDate: '2025-09-01', linkToken: 'r2w7j5h8' },
  { id: 'u1005', empNo: '1005', name: '최우진', email: 'woojin@seaon.co.kr', dept: '생산팀', position: '주임', joinDate: '2022-05-16', linkToken: 'm6f1z3y4' },
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

export function newToken(len = 10): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => abc[b % abc.length]).join('');
}

function seed(): Db {
  const employees: Employee[] = SAMPLE.map((e) => ({ ...e, active: true, annualLeave: 15 }));
  const records: Db['records'] = {};
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  // Sample check-in spots scattered around Seoul City Hall so the admin map has something to show.
  const base = { lat: 37.5665, lng: 126.978 };
  for (const e of employees) {
    if (e.id === 'u1001') continue; // the demo employee starts with a clean history
    records[e.id] = {};
    for (let d = new Date(first); d < new Date(today.getFullYear(), today.getMonth(), today.getDate()); d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const key = dateKey(d);
      const r = rand(e.id + key);
      if (r < 0.06) continue;
      const inMin = 8 * 60 + 35 + Math.floor(r * 40);
      const outMin = 18 * 60 + Math.floor(rand(key + e.id) * 90);
      const jitter = (s: string) => (rand(s) - 0.5) * 0.0016;
      records[e.id][key] = {
        date: key,
        checkIn: at(key, Math.floor(inMin / 60), inMin % 60),
        checkOut: at(key, Math.floor(outMin / 60), outMin % 60),
        inLoc: { lat: base.lat + jitter(e.id + key + 'a'), lng: base.lng + jitter(e.id + key + 'b'), accuracy: 15 },
        outLoc: { lat: base.lat + jitter(e.id + key + 'c'), lng: base.lng + jitter(e.id + key + 'd'), accuracy: 20 },
      };
    }
  }
  const tk = todayKey();
  if (today.getDay() !== 0 && today.getDay() !== 6) {
    records.u1002[tk] = { date: tk, checkIn: at(tk, 8, 51), inLoc: { lat: 37.5667, lng: 126.9785, accuracy: 12 } };
    records.u1003[tk] = { date: tk, checkIn: at(tk, 9, 12), inLoc: { lat: 37.5661, lng: 126.9774, accuracy: 18 } };
  }
  const plus = (n: number) => dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
  const requests: LeaveRequest[] = [
    { id: 'r-sample-1', empId: 'u1004', empName: '박서연', type: '연차', date: plus(3), endDate: plus(3), reason: '개인 사유', status: '대기', createdAt: new Date().toISOString() },
    { id: 'r-sample-2', empId: 'u1005', empName: '최우진', type: '조퇴', date: tk, time: '16:00', reason: '병원 진료', status: '대기', createdAt: new Date().toISOString() },
  ];
  return {
    version: 5,
    employees,
    records,
    requests,
    policy: { locationTracking: true, geofence: false, showEmployeeMap: true, allowLocationEdit: true, workplace: null },
    adminLinks: [{ token: DEMO_ADMIN_TOKEN, used: false }],
  };
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

function publicUser(e: Employee): User {
  const { id, empNo, name, email, dept, position, joinDate } = e;
  return { id, empNo, name, email, dept, position, joinDate };
}

function requireUser(): User {
  const u = readSession<User>(SESSION_KEY);
  if (!u) throw new Error('개인 링크로 다시 접속해 주세요.');
  return u;
}

function requireAdmin() {
  if (!readSession<Admin>(ADMIN_SESSION_KEY)) throw new Error('관리자 링크로 다시 접속해 주세요.');
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

// Location is stored only when the admin turned location tracking on.
function keepLoc(db: Db, loc: AttendanceRecord['inLoc'] | null) {
  return db.policy.locationTracking && loc ? loc : undefined;
}

export const demoApi: Api = {
  async enterWithLink(token) {
    await delay(300);
    const found = load().employees.find((e) => e.linkToken === token);
    if (!found) throw new Error('링크가 올바르지 않거나 만료되었습니다. 관리자에게 새 링크를 요청하세요.');
    if (!found.active) throw new Error('사용이 중지된 계정입니다. 관리자에게 문의하세요.');
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

  async getPolicy() {
    return load().policy;
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
    mine[date] = { date, checkIn: new Date().toISOString(), inLoc: keepLoc(db, loc) };
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
    rec.outLoc = keepLoc(db, loc);
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
  async enterWithLink(token) {
    await delay(300);
    const db = load();
    const link = db.adminLinks.find((l) => l.token === token);
    if (!link) throw new Error('관리자 링크가 올바르지 않습니다.');
    if (link.used) throw new Error('이미 사용된 관리자 링크입니다. 기존 관리자에게 새 링크를 요청하세요.');
    link.used = true;
    save(db);
    const admin: Admin = { id: ADMIN.id, name: ADMIN.name };
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin));
    return admin;
  },

  async login(id, password) {
    await delay(400);
    if (id.trim().toLowerCase() !== ADMIN.id || password !== ADMIN.password) throw new Error('관리자 아이디 또는 비밀번호가 올바르지 않습니다.');
    const admin: Admin = { id: ADMIN.id, name: ADMIN.name };
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

  async passwordStatus() {
    return { set: true, id: ADMIN.id };
  },

  async setPassword() {
    throw new Error('테스트 버전에서는 비밀번호를 바꿀 수 없습니다.');
  },

  async issueAdminLink() {
    requireAdmin();
    const db = load();
    const token = newToken(12);
    db.adminLinks.push({ token, used: false });
    save(db);
    return token;
  },

  async listEmployees() {
    requireAdmin();
    return load().employees;
  },

  async createEmployee(e) {
    requireAdmin();
    const db = load();
    if (db.employees.some((x) => x.empNo === e.empNo)) throw new Error('이미 사용 중인 사원번호입니다.');
    const created: Employee = { ...e, id: `u${e.empNo}-${Date.now().toString(36)}`, active: true, linkToken: newToken() };
    db.employees.push(created);
    save(db);
    return created;
  },

  async updateEmployee(id, patch) {
    requireAdmin();
    const db = load();
    const emp = db.employees.find((x) => x.id === id);
    if (!emp) throw new Error('직원을 찾을 수 없습니다.');
    Object.assign(emp, patch);
    save(db);
  },

  async regenerateLink(id) {
    requireAdmin();
    const db = load();
    const emp = db.employees.find((x) => x.id === id);
    if (!emp) throw new Error('직원을 찾을 수 없습니다.');
    emp.linkToken = newToken();
    save(db);
    return emp.linkToken;
  },

  async dayStatus(date): Promise<DayRow[]> {
    requireAdmin();
    const db = load();
    return db.employees
      .filter((e) => e.active)
      .map((e) => ({
        employee: e,
        record: db.records[e.id]?.[date] ?? null,
        leave: db.requests.find((r) => r.empId === e.id && r.status === '승인' && r.date <= date && (r.endDate ?? r.date) >= date) ?? null,
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

  async getPolicy() {
    return load().policy;
  },

  async setPolicy(p) {
    requireAdmin();
    const db = load();
    db.policy = p;
    save(db);
  },
};

export const DEMO_EMPLOYEE_TOKEN = SAMPLE[0].linkToken;
