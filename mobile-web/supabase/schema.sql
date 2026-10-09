-- 세아온 근태관리 · Supabase schema
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run: functions are replaced,
-- tables are created only if missing.
--
-- Security model: every table has RLS on with no policies, so the public (anon) key can't
-- read or write any table directly. The app only calls the SECURITY DEFINER functions
-- below, and each one checks the caller's session token first.

create extension if not exists pgcrypto with schema extensions;

-- ── Tables ─────────────────────────────────────────────────────────────

create table if not exists employees (
  id           uuid primary key default gen_random_uuid(),
  emp_no       text not null unique,
  name         text not null,
  email        text not null default '',
  dept         text not null default '',
  position     text not null default '',
  join_date    date,
  active       boolean not null default true,
  annual_leave numeric(4,1) not null default 15,
  link_token   text not null unique,
  created_at   timestamptz not null default now()
);

create table if not exists emp_sessions (
  token      text primary key,
  emp_id     uuid not null references employees(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists attendance (
  emp_id    uuid not null references employees(id) on delete cascade,
  work_date date not null,
  check_in  timestamptz,
  check_out timestamptz,
  in_loc    jsonb,
  out_loc   jsonb,
  primary key (emp_id, work_date)
);

create table if not exists leave_requests (
  id            uuid primary key default gen_random_uuid(),
  emp_id        uuid not null references employees(id) on delete cascade,
  type          text not null check (type in ('연차','오전반차','오후반차','외출','조퇴')),
  start_date    date not null,
  end_date      date,
  at_time       text,
  reason        text not null default '',
  status        text not null default '대기' check (status in ('대기','승인','반려','취소')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decision_note text
);
create index if not exists leave_requests_emp_idx on leave_requests(emp_id);

create table if not exists settings (
  id     int primary key default 1 check (id = 1),
  policy jsonb not null
);
insert into settings (id, policy)
values (1, '{"locationTracking":true,"geofence":false,"showEmployeeMap":true,"allowLocationEdit":true,"workplace":null}')
on conflict (id) do nothing;

-- Emergency id/password login. Empty until an admin sets a password in 설정.
create table if not exists admin_account (
  id            int primary key default 1 check (id = 1),
  login_id      text not null default 'admin',
  password_hash text
);
insert into admin_account (id) values (1) on conflict (id) do nothing;

create table if not exists admin_links (
  token      text primary key,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  token      text primary key,
  expires_at timestamptz not null default now() + interval '90 days'
);

alter table employees      enable row level security;
alter table emp_sessions   enable row level security;
alter table attendance     enable row level security;
alter table leave_requests enable row level security;
alter table settings       enable row level security;
alter table admin_account  enable row level security;
alter table admin_links    enable row level security;
alter table admin_sessions enable row level security;

-- ── Helpers (not callable by the app) ──────────────────────────────────

create or replace function _token(len int) returns text
language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (get_byte(b, i) % 31) + 1, 1), '')
  from (select gen_random_bytes(len) as b) r, generate_series(0, len - 1) i
$$;

create or replace function _today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Seoul')::date $$;

create or replace function _emp(p_session text) returns employees
language plpgsql stable security definer set search_path = public as $$
declare e employees;
begin
  select x.* into e from emp_sessions s join employees x on x.id = s.emp_id where s.token = p_session;
  if e.id is null then raise exception '개인 링크로 다시 접속해 주세요.'; end if;
  if not e.active then raise exception '사용이 중지된 계정입니다. 관리자에게 문의하세요.'; end if;
  return e;
end $$;

create or replace function _admin(p_session text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_sessions where token = p_session and expires_at > now()) then
    raise exception '관리자 링크로 다시 접속해 주세요.';
  end if;
end $$;

create or replace function _new_admin_session() returns json
language plpgsql security definer set search_path = public as $$
declare t text := _token(32);
begin
  delete from admin_sessions where expires_at < now();
  insert into admin_sessions (token) values (t);
  return json_build_object('session', t, 'admin', json_build_object('id', 'admin', 'name', '관리자'));
end $$;

create or replace function _user_json(e employees) returns json
language sql stable as $$
  select json_build_object('id', e.id, 'empNo', e.emp_no, 'name', e.name, 'email', e.email,
    'dept', e.dept, 'position', e.position, 'joinDate', coalesce(to_char(e.join_date, 'YYYY-MM-DD'), ''))
$$;

create or replace function _employee_json(e employees) returns json
language sql stable as $$
  select (_user_json(e)::jsonb || jsonb_build_object('active', e.active, 'annualLeave', e.annual_leave, 'linkToken', e.link_token))::json
$$;

create or replace function _record_json(a attendance) returns json
language sql stable as $$
  select json_strip_nulls(json_build_object('date', to_char(a.work_date, 'YYYY-MM-DD'),
    'checkIn', a.check_in, 'checkOut', a.check_out, 'inLoc', a.in_loc, 'outLoc', a.out_loc))
$$;

create or replace function _request_json(r leave_requests, emp_name text) returns json
language sql stable as $$
  select json_strip_nulls(json_build_object('id', r.id, 'empId', r.emp_id, 'empName', emp_name, 'type', r.type,
    'date', to_char(r.start_date, 'YYYY-MM-DD'), 'endDate', to_char(r.end_date, 'YYYY-MM-DD'), 'time', r.at_time,
    'reason', r.reason, 'status', r.status, 'createdAt', r.created_at, 'decidedAt', r.decided_at,
    'decisionNote', r.decision_note))
$$;

create or replace function _leave_days(r leave_requests) returns numeric
language sql immutable as $$
  select case
    when r.type = '연차' then greatest(1, coalesce(r.end_date, r.start_date) - r.start_date + 1)
    when r.type in ('오전반차','오후반차') then 0.5
    else 0 end
$$;

create or replace function _balance(p_emp uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total', (select annual_leave from employees where id = p_emp),
    'used', coalesce(sum(_leave_days(r)) filter (where r.status = '승인'), 0),
    'pending', coalesce(sum(_leave_days(r)) filter (where r.status = '대기'), 0))
  from leave_requests r where r.emp_id = p_emp
$$;

create or replace function _distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Server-side copy of the app's location rules, so a modified client can't skip them.
-- Returns the location to store, or null when location tracking is off.
create or replace function _check_loc(p_loc jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pol jsonb := (select policy from settings where id = 1);
  wp jsonb := pol -> 'workplace';
begin
  if p_loc is not null and coalesce((p_loc ->> 'edited')::boolean, false) then
    if p_loc -> 'gps' is null or _distance_m((p_loc #>> '{gps,lat}')::float8, (p_loc #>> '{gps,lng}')::float8,
         (p_loc ->> 'lat')::float8, (p_loc ->> 'lng')::float8) > 300 then
      raise exception '수정한 위치가 실제 위치에서 300m 넘게 떨어져 있습니다.';
    end if;
  end if;
  if coalesce((pol ->> 'geofence')::boolean, false) and jsonb_typeof(wp) = 'object' then
    if p_loc is null then raise exception '회사 근처에서만 출퇴근할 수 있습니다. 위치 권한을 허용해 주세요.'; end if;
    if _distance_m((p_loc ->> 'lat')::float8, (p_loc ->> 'lng')::float8, (wp ->> 'lat')::float8, (wp ->> 'lng')::float8)
       > (wp ->> 'radius')::float8 then
      raise exception '회사 근처에서만 출퇴근할 수 있습니다.';
    end if;
  end if;
  return case when coalesce((pol ->> 'locationTracking')::boolean, false) then p_loc else null end;
end $$;

-- ── Employee API ───────────────────────────────────────────────────────

create or replace function emp_enter(p_link text) returns json
language plpgsql security definer set search_path = public as $$
declare e employees; t text := _token(32);
begin
  select * into e from employees where link_token = p_link;
  if e.id is null then raise exception '링크가 올바르지 않거나 만료되었습니다. 관리자에게 새 링크를 요청하세요.'; end if;
  if not e.active then raise exception '사용이 중지된 계정입니다. 관리자에게 문의하세요.'; end if;
  insert into emp_sessions (token, emp_id) values (t, e.id);
  return json_build_object('session', t, 'user', _user_json(e));
end $$;

create or replace function emp_logout(p_session text) returns void
language sql security definer set search_path = public as $$
  delete from emp_sessions where token = p_session
$$;

create or replace function get_policy(p_session text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from emp_sessions where token = p_session)
     and not exists (select 1 from admin_sessions where token = p_session and expires_at > now()) then
    raise exception '다시 접속해 주세요.';
  end if;
  return (select policy::json from settings where id = 1);
end $$;

create or replace function emp_record(p_session text, p_date date) returns json
language sql stable security definer set search_path = public as $$
  select _record_json(a) from attendance a where a.emp_id = (_emp(p_session)).id and a.work_date = p_date
$$;

create or replace function emp_check_in(p_session text, p_loc jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare e employees := _emp(p_session); a attendance; loc jsonb := _check_loc(p_loc);
begin
  insert into attendance (emp_id, work_date, check_in, in_loc) values (e.id, _today(), now(), loc)
  on conflict (emp_id, work_date) do update set check_in = excluded.check_in, in_loc = excluded.in_loc
    where attendance.check_in is null
  returning * into a;
  if a.emp_id is null then raise exception '이미 출근 처리되었습니다.'; end if;
  return _record_json(a);
end $$;

create or replace function emp_check_out(p_session text, p_loc jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare e employees := _emp(p_session); a attendance; loc jsonb;
begin
  select * into a from attendance where emp_id = e.id and work_date = _today() for update;
  if a.check_in is null then raise exception '출근 기록이 없습니다. 먼저 출근해 주세요.'; end if;
  if a.check_out is not null then raise exception '이미 퇴근 처리되었습니다.'; end if;
  loc := _check_loc(p_loc);
  update attendance set check_out = now(), out_loc = loc where emp_id = e.id and work_date = a.work_date returning * into a;
  return _record_json(a);
end $$;

create or replace function emp_records(p_session text, p_month text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(_record_json(a) order by a.work_date desc), '[]')
  from attendance a
  where a.emp_id = (_emp(p_session)).id and to_char(a.work_date, 'YYYY-MM') = p_month
$$;

create or replace function emp_requests(p_session text) returns json
language plpgsql stable security definer set search_path = public as $$
declare e employees := _emp(p_session);
begin
  return (select coalesce(json_agg(_request_json(r, e.name) order by r.created_at desc), '[]')
          from leave_requests r where r.emp_id = e.id);
end $$;

create or replace function emp_create_request(p_session text, p_type text, p_date date, p_end_date date, p_time text, p_reason text)
returns json language plpgsql security definer set search_path = public as $$
declare e employees := _emp(p_session); r leave_requests;
begin
  if p_end_date is not null and p_end_date < p_date then raise exception '종료일이 시작일보다 빠릅니다.'; end if;
  insert into leave_requests (emp_id, type, start_date, end_date, at_time, reason)
  values (e.id, p_type, p_date, p_end_date, nullif(p_time, ''), coalesce(p_reason, ''))
  returning * into r;
  return _request_json(r, e.name);
end $$;

create or replace function emp_cancel_request(p_session text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e employees := _emp(p_session);
begin
  update leave_requests set status = '취소' where id = p_id and emp_id = e.id and status = '대기';
end $$;

create or replace function emp_balance(p_session text) returns json
language sql stable security definer set search_path = public as $$
  select _balance((_emp(p_session)).id)
$$;

-- ── Admin API ──────────────────────────────────────────────────────────

create or replace function admin_enter(p_link text) returns json
language plpgsql security definer set search_path = public as $$
begin
  update admin_links set used = true where token = p_link and not used;
  if not found then
    if exists (select 1 from admin_links where token = p_link) then
      raise exception '이미 사용된 관리자 링크입니다. 기존 관리자에게 새 링크를 요청하세요.';
    end if;
    raise exception '관리자 링크가 올바르지 않습니다.';
  end if;
  return _new_admin_session();
end $$;

create or replace function admin_login(p_id text, p_password text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare acc admin_account := (select a from admin_account a where id = 1);
begin
  perform pg_sleep(0.4); -- slows down password guessing
  if acc.password_hash is null or lower(trim(p_id)) <> lower(acc.login_id)
     or crypt(p_password, acc.password_hash) <> acc.password_hash then
    raise exception '관리자 아이디 또는 비밀번호가 올바르지 않습니다.';
  end if;
  return _new_admin_session();
end $$;

create or replace function admin_set_password(p_session text, p_id text, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _admin(p_session);
  if length(coalesce(trim(p_id), '')) < 3 then raise exception '아이디는 3자 이상이어야 합니다.'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception '비밀번호는 8자 이상이어야 합니다.'; end if;
  update admin_account set login_id = lower(trim(p_id)), password_hash = crypt(p_password, gen_salt('bf')) where id = 1;
end $$;

create or replace function admin_has_password(p_session text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _admin(p_session);
  return (select json_build_object('set', password_hash is not null, 'id', login_id) from admin_account where id = 1);
end $$;

create or replace function admin_logout(p_session text) returns void
language sql security definer set search_path = public as $$
  delete from admin_sessions where token = p_session
$$;

create or replace function admin_issue_link(p_session text) returns text
language plpgsql security definer set search_path = public as $$
declare t text := _token(16);
begin
  perform _admin(p_session);
  insert into admin_links (token) values (t);
  return t;
end $$;

create or replace function admin_employees(p_session text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _admin(p_session);
  return (select coalesce(json_agg(_employee_json(e) order by e.emp_no), '[]') from employees e);
end $$;

create or replace function admin_create_employee(p_session text, p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare e employees;
begin
  perform _admin(p_session);
  if exists (select 1 from employees where emp_no = trim(p ->> 'empNo')) then raise exception '이미 사용 중인 사원번호입니다.'; end if;
  insert into employees (emp_no, name, email, dept, position, join_date, annual_leave, link_token)
  values (trim(p ->> 'empNo'), trim(p ->> 'name'), coalesce(p ->> 'email', ''), coalesce(p ->> 'dept', ''),
          coalesce(p ->> 'position', ''), nullif(p ->> 'joinDate', '')::date,
          coalesce((p ->> 'annualLeave')::numeric, 15), _token(12))
  returning * into e;
  return _employee_json(e);
end $$;

create or replace function admin_update_employee(p_session text, p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_session);
  if p ? 'empNo' and exists (select 1 from employees where emp_no = trim(p ->> 'empNo') and id <> p_id) then
    raise exception '이미 사용 중인 사원번호입니다.';
  end if;
  update employees set
    emp_no       = coalesce(trim(p ->> 'empNo'), emp_no),
    name         = coalesce(p ->> 'name', name),
    email        = coalesce(p ->> 'email', email),
    dept         = coalesce(p ->> 'dept', dept),
    position     = coalesce(p ->> 'position', position),
    join_date    = case when p ? 'joinDate' then nullif(p ->> 'joinDate', '')::date else join_date end,
    active       = coalesce((p ->> 'active')::boolean, active),
    annual_leave = coalesce((p ->> 'annualLeave')::numeric, annual_leave)
  where id = p_id;
  if not found then raise exception '직원을 찾을 수 없습니다.'; end if;
  -- A deactivated employee is signed out everywhere.
  if (p ->> 'active')::boolean is false then delete from emp_sessions where emp_id = p_id; end if;
end $$;

-- A new link also signs the employee out of every device that used the old one (lost phone).
create or replace function admin_regenerate_link(p_session text, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare t text := _token(12);
begin
  perform _admin(p_session);
  update employees set link_token = t where id = p_id;
  if not found then raise exception '직원을 찾을 수 없습니다.'; end if;
  delete from emp_sessions where emp_id = p_id;
  return t;
end $$;

create or replace function admin_day_status(p_session text, p_date date) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _admin(p_session);
  return (
    select coalesce(json_agg(json_build_object(
      'employee', _employee_json(e),
      'record', (select _record_json(a) from attendance a where a.emp_id = e.id and a.work_date = p_date),
      'leave', (select _request_json(r, e.name) from leave_requests r
                where r.emp_id = e.id and r.status = '승인'
                  and r.start_date <= p_date and coalesce(r.end_date, r.start_date) >= p_date
                order by r.created_at limit 1)
    ) order by e.emp_no), '[]')
    from employees e where e.active);
end $$;

create or replace function admin_records(p_session text, p_from date, p_to date, p_emp uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _admin(p_session);
  return (
    select coalesce(json_agg((_record_json(a)::jsonb || jsonb_build_object('empId', a.emp_id))::json
                             order by a.work_date desc, a.emp_id), '[]')
    from attendance a
    where a.work_date between p_from and p_to and (p_emp is null or a.emp_id = p_emp));
end $$;

create or replace function admin_requests(p_session text, p_status text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _admin(p_session);
  return (
    select coalesce(json_agg(_request_json(r, e.name) order by r.created_at desc), '[]')
    from leave_requests r join employees e on e.id = r.emp_id
    where p_status is null or r.status = p_status);
end $$;

create or replace function admin_decide_request(p_session text, p_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform _admin(p_session);
  if p_status not in ('승인','반려') then raise exception '잘못된 처리입니다.'; end if;
  select status into cur from leave_requests where id = p_id for update;
  if cur is null then raise exception '신청을 찾을 수 없습니다.'; end if;
  if cur <> '대기' then raise exception '이미 처리된 신청입니다.'; end if;
  update leave_requests set status = p_status, decided_at = now(), decision_note = nullif(p_note, '') where id = p_id;
end $$;

create or replace function admin_balance(p_session text, p_emp uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _admin(p_session);
  return _balance(p_emp);
end $$;

create or replace function admin_set_policy(p_session text, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_session);
  update settings set policy = p where id = 1;
end $$;

-- ── Permissions: the app may call only the public API functions ────────

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  emp_enter(text), emp_logout(text), get_policy(text), emp_record(text, date),
  emp_check_in(text, jsonb), emp_check_out(text, jsonb), emp_records(text, text),
  emp_requests(text), emp_create_request(text, text, date, date, text, text),
  emp_cancel_request(text, uuid), emp_balance(text),
  admin_enter(text), admin_login(text, text), admin_set_password(text, text, text),
  admin_has_password(text), admin_logout(text), admin_issue_link(text),
  admin_employees(text), admin_create_employee(text, jsonb), admin_update_employee(text, uuid, jsonb),
  admin_regenerate_link(text, uuid), admin_day_status(text, date), admin_records(text, date, date, uuid),
  admin_requests(text, text), admin_decide_request(text, uuid, text, text), admin_balance(text, uuid),
  admin_set_policy(text, jsonb)
to anon;

-- ── First admin link ───────────────────────────────────────────────────
-- Creates one unused admin link when none exists yet and shows it as the query result.
-- Open  https://7416979-create.github.io/seaon-app/?go=/a/<token>  on the admin PC.
insert into admin_links (token)
select _token(16) where not exists (select 1 from admin_links);
select token as "첫 관리자 링크 토큰", 'https://7416979-create.github.io/seaon-app/?go=/a/' || token as "관리자 링크"
from admin_links where not used order by created_at limit 1;
