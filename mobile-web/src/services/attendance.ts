import { readJson, writeJson } from './storage'
import type { Coordinates } from './geolocation'

export interface AttendanceRecord {
  /** Local date, YYYY-MM-DD */
  date: string
  checkIn?: string // ISO timestamp
  checkOut?: string // ISO timestamp
  checkInLocation?: Coordinates
  checkOutLocation?: Coordinates
}

export type AttendanceStatus = 'before' | 'working' | 'done'

// Mock store keyed per employee. Replace these functions with API calls when the backend exists.
const key = (employeeNo: string) => `seaon.attendance.${employeeNo}`

export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function listRecords(employeeNo: string): AttendanceRecord[] {
  return readJson<AttendanceRecord[]>(key(employeeNo), []).sort((a, b) => b.date.localeCompare(a.date))
}

export function getToday(employeeNo: string): AttendanceRecord {
  const today = todayKey()
  return listRecords(employeeNo).find((r) => r.date === today) ?? { date: today }
}

export function statusOf(r: AttendanceRecord): AttendanceStatus {
  if (r.checkOut) return 'done'
  if (r.checkIn) return 'working'
  return 'before'
}

function save(employeeNo: string, record: AttendanceRecord): AttendanceRecord {
  const others = listRecords(employeeNo).filter((r) => r.date !== record.date)
  writeJson(key(employeeNo), [record, ...others])
  return record
}

export async function checkIn(employeeNo: string, location?: Coordinates): Promise<AttendanceRecord> {
  const r = getToday(employeeNo)
  if (r.checkIn) throw new Error('이미 출근 처리되었습니다.')
  return save(employeeNo, { ...r, checkIn: new Date().toISOString(), checkInLocation: location })
}

export async function checkOut(employeeNo: string, location?: Coordinates): Promise<AttendanceRecord> {
  const r = getToday(employeeNo)
  if (!r.checkIn) throw new Error('출근 기록이 없습니다.')
  if (r.checkOut) throw new Error('이미 퇴근 처리되었습니다.')
  return save(employeeNo, { ...r, checkOut: new Date().toISOString(), checkOutLocation: location })
}

export function workedMinutes(r: AttendanceRecord, now = new Date()): number {
  if (!r.checkIn) return 0
  const end = r.checkOut ? new Date(r.checkOut) : now
  return Math.max(0, Math.floor((end.getTime() - new Date(r.checkIn).getTime()) / 60000))
}

export function formatTime(iso?: string): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
}
