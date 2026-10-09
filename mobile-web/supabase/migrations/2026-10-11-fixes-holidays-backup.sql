-- 2026-10-11: attendance correction requests, holidays, data backup export.
-- Safe to run more than once. Run AFTER 2026-10-10-employee-phone-link-status.sql.
-- Does not change existing rows (adds attendance.fixed = false to every row).

-- ── Tables ─────────────────────────────────────────────────────────────

alter table attendance add column if not exists fixed boolean not null default false;

create table if not exists attendance_fixes (
  id            uuid primary key default gen_random_uuid(),
  emp_id        uuid not null references employees(id) on delete cascade,
  work_date     date not null,
  check_in      timestamptz,
  check_out     timestamptz,
  reason        text not null default '',
  status        text not null default '대기' check (status in ('대기','승인','반려','취소')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decision_note text
);
create index if not exists attendance_fixes_emp_idx on attendance_fixes(emp_id);
alter table attendance_fixes enable row level security;

create table if not exists holidays (
  day  date primary key,
  name text not null default ''
);
alter table holidays enable row level security;

revoke all on table attendance_fixes, holidays from anon, authenticated;

-- ── JSON helpers ───────────────────────────────────────────────────────

-- Records now say when an admin applied a correction.
create or replace function _record_json(a attendance) returns json
language sql stable as $$
  select json_strip_nulls(json_build_object('date', to_char(a.work_date, 'YYYY-MM-DD'),
    'checkIn', a.check_in, 'checkOut', a.check_out, 'inLoc', a.in_loc, 'outLoc', a.out_loc,
    'fixed', case when a.fixed then true end))
$$;

create or replace function _fix_json(f attendance_fixes, emp_name text) returns json
language sql stable as $$
  select json_strip_nulls(json_build_object('id', f.id, 'empId', f.emp_id, 'empName', emp_name,
    'date', to_char(f.work_date, 'YYYY-MM-DD'), 'checkIn', f.check_in, 'checkOut', f.check_out,
    'reason', f.reason, 'status', f.status, 'createdAt', f.created_at, 'decidedAt', f.decided_at,
    'decisionNote', f.decision_note))
$$;

-- ── Correction requests: employee ──────────────────────────────────────

-- p_in / p_out are 'HH:MM' in Korea time, or null/'' when that side is not being corrected.
create or replace function emp_fix_create(p_session text, p_date date, p_in text, p_out text, p_reason text) returns json
language plpgsql security definer set search_path = public as $$
declare e employees := _emp(p_session); f attendance_fixes; t_in timestamptz; t_out timestamptz;
begin
  if p_date > _today() then raise exception '미래 날짜는 정정할 수 없습니다.'; end if;
  if p_date < _today() - 31 then raise exception '31일이 지난 기록은 정정할 수 없습니다. 관리자에게 문의하세요.'; end if;
  if nullif(trim(p_in), '') is null and nullif(trim(p_out), '') is null then raise exception '출근 또는 퇴근 시각을 입력해 주세요.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception '정정 사유를 입력해 주세요.'; end if;
  if nullif(trim(p_in), '') is not null then t_in := (p_date + trim(p_in)::time) at time zone 'Asia/Seoul'; end if;
  if nullif(trim(p_out), '') is not null then t_out := (p_date + trim(p_out)::time) at time zone 'Asia/Seoul'; end if;
  if t_in is not null and t_out is not null and t_out <= t_in then raise exception '퇴근 시각은 출근 시각보다 늦어야 합니다.'; end if;
  if exists (select 1 from attendance_fixes where emp_id = e.id and work_date = p_date and status = '대기') then
    raise exception '같은 날짜의 정정 신청이 이미 대기 중입니다.';
  end if;
  insert into attendance_fixes (emp_id, work_date, check_in, check_out, reason)
  values (e.id, p_date, t_in, t_out, trim(p_reason))
  returning * into f;
  return _fix_json(f, e.name);
end $$;

create or replace function emp_fixes(p_session text) returns json
language plpgsql stable security definer set search_path = public as $$
declare e employees := _emp(p_session);
begin
  return (select coalesce(json_agg(_fix_json(f, e.name) order by f.created_at desc), '[]')
          from attendance_fixes f where f.emp_id = e.id);
end $$;

create or replace function emp_fix_cancel(p_session text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e employees := _emp(p_session);
begin
  update attendance_fixes set status = '취소' where id = p_id and emp_id = e.id and status = '대기';
end $$;

-- ── Correction requests: admin ─────────────────────────────────────────

create or replace function admin_fixes(p_session text, p_status text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _admin(p_session);
  return (
    select coalesce(json_agg(_fix_json(f, e.name) order by f.created_at desc), '[]')
    from attendance_fixes f join employees e on e.id = f.emp_id
    where p_status is null or f.status = p_status);
end $$;

-- Approving writes the corrected times into attendance and marks the day as fixed.
-- Only the sides the employee filled in are changed. Any error rolls back the whole decision.
create or replace function admin_fix_decide(p_session text, p_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare f attendance_fixes; a attendance;
begin
  perform _admin(p_session);
  if p_status not in ('승인','반려') then raise exception '잘못된 처리입니다.'; end if;
  select * into f from attendance_fixes where id = p_id for update;
  if f.id is null then raise exception '정정 신청을 찾을 수 없습니다.'; end if;
  if f.status <> '대기' then raise exception '이미 처리된 신청입니다.'; end if;
  update attendance_fixes set status = p_status, decided_at = now(), decision_note = nullif(p_note, '') where id = p_id;
  if p_status = '승인' then
    insert into attendance (emp_id, work_date, check_in, check_out, fixed)
    values (f.emp_id, f.work_date, f.check_in, f.check_out, true)
    on conflict (emp_id, work_date) do update set
      check_in  = coalesce(excluded.check_in, attendance.check_in),
      check_out = coalesce(excluded.check_out, attendance.check_out),
      fixed     = true
    returning * into a;
    if a.check_in is not null and a.check_out is not null and a.check_out <= a.check_in then
      raise exception '정정하면 퇴근 시각이 출근 시각보다 빨라집니다. 반려해 주세요.';
    end if;
  end if;
end $$;

-- ── Holidays ───────────────────────────────────────────────────────────

-- Readable by any signed-in employee or admin.
create or replace function get_holidays(p_session text, p_from date, p_to date) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from emp_sessions where token = p_session)
     and not exists (select 1 from admin_sessions where token = p_session and expires_at > now()) then
    raise exception '다시 접속해 주세요.';
  end if;
  return (select coalesce(json_agg(json_build_object('date', to_char(day, 'YYYY-MM-DD'), 'name', name) order by day), '[]')
          from holidays where day between p_from and p_to);
end $$;

create or replace function admin_set_holiday(p_session text, p_day date, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_session);
  insert into holidays (day, name) values (p_day, coalesce(trim(p_name), ''))
  on conflict (day) do update set name = excluded.name;
end $$;

create or replace function admin_delete_holiday(p_session text, p_day date) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_session);
  delete from holidays where day = p_day;
end $$;

-- ── Backup export ──────────────────────────────────────────────────────

-- Everything an admin needs to keep a copy of the data. Personal link tokens are left out on
-- purpose: they are secrets, and after a restore every employee gets a new link anyway.
create or replace function admin_export(p_session text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _admin(p_session);
  return json_build_object(
    'version', 1,
    'exportedAt', now(),
    'employees', (select coalesce(json_agg(json_build_object(
        'id', id, 'empNo', emp_no, 'name', name, 'email', email, 'dept', dept, 'position', position,
        'joinDate', join_date, 'active', active, 'annualLeave', annual_leave, 'phone', phone,
        'linkUsedAt', link_used_at, 'createdAt', created_at) order by emp_no), '[]') from employees),
    'attendance', (select coalesce(json_agg(row_to_json(a) order by a.work_date, a.emp_id), '[]') from attendance a),
    'leaveRequests', (select coalesce(json_agg(row_to_json(r) order by r.created_at), '[]') from leave_requests r),
    'attendanceFixes', (select coalesce(json_agg(row_to_json(f) order by f.created_at), '[]') from attendance_fixes f),
    'holidays', (select coalesce(json_agg(row_to_json(h) order by h.day), '[]') from holidays h),
    'settings', (select policy from settings where id = 1));
end $$;

-- ── Permissions ────────────────────────────────────────────────────────
-- Supabase gives new functions to anon by default; internal helpers must be closed again.

revoke all on function _fix_json(attendance_fixes, text) from public, anon, authenticated;

grant execute on function
  emp_fix_create(text, date, text, text, text), emp_fixes(text), emp_fix_cancel(text, uuid),
  admin_fixes(text, text), admin_fix_decide(text, uuid, text, text),
  get_holidays(text, date, date), admin_set_holiday(text, date, text), admin_delete_holiday(text, date),
  admin_export(text)
to anon;

-- Check after running (expect: true, true, true, true, false):
-- select exists (select 1 from information_schema.tables where table_name = 'attendance_fixes') as fixes_table,
--        exists (select 1 from information_schema.tables where table_name = 'holidays') as holidays_table,
--        exists (select 1 from information_schema.columns where table_name = 'attendance' and column_name = 'fixed') as fixed_column,
--        has_function_privilege('anon', 'admin_export(text)', 'execute') as export_callable,
--        has_function_privilege('anon', '_fix_json(attendance_fixes, text)', 'execute') as helper_callable;
