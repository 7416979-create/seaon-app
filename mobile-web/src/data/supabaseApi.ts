import type { Admin, AdminApi, Api, AttendanceRecord, DayRow, Employee, LeaveBalance, LeaveRequest, Policy, User } from './types';

// Server mode: every call goes to a Postgres function in Supabase (see supabase/schema.sql).
// Tables are closed to the public key; the functions check the session token we send.

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const USER_KEY = 'seaon.sb.user';
const USER_TOKEN_KEY = 'seaon.sb.token';
const ADMIN_KEY = 'seaon.sb.admin';
const ADMIN_TOKEN_KEY = 'seaon.sb.adminToken';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function clear(...keys: string[]) {
  for (const k of keys) localStorage.removeItem(k);
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      // Legacy anon keys are JWTs and go in Authorization too; new sb_publishable_ keys go only in apikey.
      headers: { apikey: KEY, ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.');
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message: string = body?.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    // The server no longer knows this session (link regenerated, account stopped, expired).
    if (message.includes('다시 접속') || message.includes('사용이 중지된')) {
      if (fn.startsWith('admin_')) clear(ADMIN_KEY, ADMIN_TOKEN_KEY);
      else if (fn.startsWith('emp_')) clear(USER_KEY, USER_TOKEN_KEY);
    }
    throw new Error(message);
  }
  return body as T;
}

const userToken = () => localStorage.getItem(USER_TOKEN_KEY) ?? '';
const adminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY) ?? '';

export const supabaseApi: Api = {
  async enterWithLink(token) {
    const { session, user } = await rpc<{ session: string; user: User }>('emp_enter', { p_link: token });
    localStorage.setItem(USER_TOKEN_KEY, session);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  async logout() {
    await rpc('emp_logout', { p_session: userToken() }).catch(() => undefined);
    clear(USER_KEY, USER_TOKEN_KEY);
  },

  currentUser() {
    return read<User>(USER_KEY);
  },

  getPolicy: () => rpc<Policy>('get_policy', { p_session: userToken() }),
  getRecord: (date) => rpc<AttendanceRecord | null>('emp_record', { p_session: userToken(), p_date: date }),
  checkIn: (loc) => rpc<AttendanceRecord>('emp_check_in', { p_session: userToken(), p_loc: loc }),
  checkOut: (loc) => rpc<AttendanceRecord>('emp_check_out', { p_session: userToken(), p_loc: loc }),
  getRecords: (month) => rpc<AttendanceRecord[]>('emp_records', { p_session: userToken(), p_month: month }),
  listRequests: () => rpc<LeaveRequest[]>('emp_requests', { p_session: userToken() }),
  createRequest: (r) =>
    rpc<LeaveRequest>('emp_create_request', {
      p_session: userToken(),
      p_type: r.type,
      p_date: r.date,
      p_end_date: r.endDate ?? null,
      p_time: r.time ?? null,
      p_reason: r.reason,
    }),
  cancelRequest: (id) => rpc<void>('emp_cancel_request', { p_session: userToken(), p_id: id }),
  leaveBalance: () => rpc<LeaveBalance>('emp_balance', { p_session: userToken() }),
};

async function startAdmin(p: Promise<{ session: string; admin: Admin }>): Promise<Admin> {
  const { session, admin } = await p;
  localStorage.setItem(ADMIN_TOKEN_KEY, session);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  return admin;
}

export const supabaseAdminApi: AdminApi = {
  enterWithLink: (token) => startAdmin(rpc('admin_enter', { p_link: token })),
  login: (id, password) => startAdmin(rpc('admin_login', { p_id: id, p_password: password })),

  async logout() {
    await rpc('admin_logout', { p_session: adminToken() }).catch(() => undefined);
    clear(ADMIN_KEY, ADMIN_TOKEN_KEY);
  },

  currentAdmin() {
    return read<Admin>(ADMIN_KEY);
  },

  passwordStatus: () => rpc<{ set: boolean; id: string }>('admin_has_password', { p_session: adminToken() }),
  setPassword: (id, password) => rpc<void>('admin_set_password', { p_session: adminToken(), p_id: id, p_password: password }),
  issueAdminLink: () => rpc<string>('admin_issue_link', { p_session: adminToken() }),
  listEmployees: () => rpc<Employee[]>('admin_employees', { p_session: adminToken() }),
  createEmployee: (e) => rpc<Employee>('admin_create_employee', { p_session: adminToken(), p: e }),
  updateEmployee: (id, patch) => rpc<void>('admin_update_employee', { p_session: adminToken(), p_id: id, p: patch }),
  regenerateLink: (id) => rpc<string>('admin_regenerate_link', { p_session: adminToken(), p_id: id }),
  dayStatus: (date) => rpc<DayRow[]>('admin_day_status', { p_session: adminToken(), p_date: date }),
  records: (from, to, empId) =>
    rpc<Array<AttendanceRecord & { empId: string }>>('admin_records', { p_session: adminToken(), p_from: from, p_to: to, p_emp: empId ?? null }),
  listRequests: (status) => rpc<LeaveRequest[]>('admin_requests', { p_session: adminToken(), p_status: status ?? null }),
  decideRequest: (id, status, note) => rpc<void>('admin_decide_request', { p_session: adminToken(), p_id: id, p_status: status, p_note: note ?? null }),
  leaveBalanceOf: (empId) => rpc<LeaveBalance>('admin_balance', { p_session: adminToken(), p_emp: empId }),
  getPolicy: () => rpc<Policy>('get_policy', { p_session: adminToken() }),
  setPolicy: (p) => rpc<void>('admin_set_policy', { p_session: adminToken(), p }),
};
