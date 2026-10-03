export interface User {
  id: string;
  empNo: string;
  name: string;
  email: string;
  dept: string;
  position: string;
  joinDate: string;
}

export interface Workplace {
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

export interface CheckLocation {
  lat: number;
  lng: number;
  accuracy: number;
  distance: number;
}

export interface AttendanceRecord {
  date: string;
  checkIn?: string;
  checkOut?: string;
  inLoc?: CheckLocation;
  outLoc?: CheckLocation;
}

export const REQUEST_TYPES = ['연차', '오전반차', '오후반차', '외출', '조퇴'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export type RequestStatus = '대기' | '승인' | '반려' | '취소';

export interface LeaveRequest {
  id: string;
  empId: string;
  empName: string;
  type: RequestType;
  date: string;
  endDate?: string;
  time?: string;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  decidedAt?: string;
  decisionNote?: string;
}

export interface LeaveBalance {
  total: number;
  used: number;
  pending: number;
}

// Every screen talks to this interface; swap the demo implementation for a server-backed one later.
export interface Api {
  login(id: string, password: string): Promise<User>;
  logout(): Promise<void>;
  currentUser(): User | null;
  getWorkplace(): Promise<Workplace | null>;
  setWorkplace(wp: Workplace): Promise<void>;
  getRecord(date: string): Promise<AttendanceRecord | null>;
  checkIn(loc: CheckLocation): Promise<AttendanceRecord>;
  checkOut(loc: CheckLocation): Promise<AttendanceRecord>;
  getRecords(month: string): Promise<AttendanceRecord[]>;
  listRequests(): Promise<LeaveRequest[]>;
  createRequest(req: Pick<LeaveRequest, 'type' | 'date' | 'endDate' | 'time' | 'reason'>): Promise<LeaveRequest>;
  cancelRequest(id: string): Promise<void>;
  leaveBalance(): Promise<LeaveBalance>;
}

export interface Employee extends User {
  active: boolean;
  annualLeave: number;
}

export type NewEmployee = Omit<Employee, 'id' | 'active'> & { password: string };

export interface DayRow {
  employee: Employee;
  record: AttendanceRecord | null;
  leave: LeaveRequest | null;
}

export interface Admin {
  id: string;
  name: string;
}

export interface AdminApi {
  login(id: string, password: string): Promise<Admin>;
  logout(): Promise<void>;
  currentAdmin(): Admin | null;
  listEmployees(): Promise<Employee[]>;
  createEmployee(e: NewEmployee): Promise<Employee>;
  updateEmployee(id: string, patch: Partial<Omit<Employee, 'id'>>): Promise<void>;
  resetPassword(id: string, password: string): Promise<void>;
  dayStatus(date: string): Promise<DayRow[]>;
  records(from: string, to: string, empId?: string): Promise<Array<AttendanceRecord & { empId: string }>>;
  listRequests(status?: RequestStatus): Promise<LeaveRequest[]>;
  decideRequest(id: string, status: '승인' | '반려', note?: string): Promise<void>;
  leaveBalanceOf(empId: string): Promise<LeaveBalance>;
  getWorkplace(): Promise<Workplace | null>;
  setWorkplace(wp: Workplace): Promise<void>;
}
