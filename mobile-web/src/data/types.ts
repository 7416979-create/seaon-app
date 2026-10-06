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

// Company-wide rules, set only by the admin.
export interface Policy {
  locationTracking: boolean; // record where each check-in/out happened
  geofence: boolean; // only allow check-in/out inside the workplace radius
  showEmployeeMap: boolean; // employees see their own current position on a map
  allowLocationEdit: boolean; // employees may nudge their pin (within MAX_EDIT_METERS of the GPS fix)
  workplace: Workplace | null;
}

export const MAX_EDIT_METERS = 300;

export interface CheckLocation {
  lat: number;
  lng: number;
  accuracy: number;
  distance?: number;
  // Set when the employee moved the pin; keeps the original GPS fix for the admin.
  edited?: boolean;
  gps?: { lat: number; lng: number };
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
  enterWithLink(token: string): Promise<User>;
  logout(): Promise<void>;
  currentUser(): User | null;
  getPolicy(): Promise<Policy>;
  getRecord(date: string): Promise<AttendanceRecord | null>;
  checkIn(loc: CheckLocation | null): Promise<AttendanceRecord>;
  checkOut(loc: CheckLocation | null): Promise<AttendanceRecord>;
  getRecords(month: string): Promise<AttendanceRecord[]>;
  listRequests(): Promise<LeaveRequest[]>;
  createRequest(req: Pick<LeaveRequest, 'type' | 'date' | 'endDate' | 'time' | 'reason'>): Promise<LeaveRequest>;
  cancelRequest(id: string): Promise<void>;
  leaveBalance(): Promise<LeaveBalance>;
}

export interface Employee extends User {
  active: boolean;
  annualLeave: number;
  linkToken: string;
}

export type NewEmployee = Omit<Employee, 'id' | 'active' | 'linkToken'>;

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
  enterWithLink(token: string): Promise<Admin>;
  login(id: string, password: string): Promise<Admin>;
  logout(): Promise<void>;
  currentAdmin(): Admin | null;
  issueAdminLink(): Promise<string>;
  listEmployees(): Promise<Employee[]>;
  createEmployee(e: NewEmployee): Promise<Employee>;
  updateEmployee(id: string, patch: Partial<Omit<Employee, 'id' | 'linkToken'>>): Promise<void>;
  regenerateLink(id: string): Promise<string>;
  dayStatus(date: string): Promise<DayRow[]>;
  records(from: string, to: string, empId?: string): Promise<Array<AttendanceRecord & { empId: string }>>;
  listRequests(status?: RequestStatus): Promise<LeaveRequest[]>;
  decideRequest(id: string, status: '승인' | '반려', note?: string): Promise<void>;
  leaveBalanceOf(empId: string): Promise<LeaveBalance>;
  getPolicy(): Promise<Policy>;
  setPolicy(p: Policy): Promise<void>;
}
