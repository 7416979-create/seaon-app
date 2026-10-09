-- 2026-10-10: employee phone number + link status for the admin screen.
-- Safe to run more than once. Run in Supabase → SQL Editor AFTER 2026-10-09-link-used-once.sql.
-- Does not touch existing rows except adding an empty phone value.

alter table employees add column if not exists phone text not null default '';

-- Admin-facing employee JSON now includes phone and when the link was first used (null = not yet).
create or replace function _employee_json(e employees) returns json
language sql stable as $$
  select (_user_json(e)::jsonb || jsonb_build_object('active', e.active, 'annualLeave', e.annual_leave,
    'linkToken', e.link_token, 'linkUsedAt', e.link_used_at, 'phone', e.phone))::json
$$;

create or replace function admin_create_employee(p_session text, p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare e employees;
begin
  perform _admin(p_session);
  if exists (select 1 from employees where emp_no = trim(p ->> 'empNo')) then raise exception '이미 사용 중인 사원번호입니다.'; end if;
  insert into employees (emp_no, name, email, dept, position, join_date, annual_leave, phone, link_token)
  values (trim(p ->> 'empNo'), trim(p ->> 'name'), coalesce(p ->> 'email', ''), coalesce(p ->> 'dept', ''),
          coalesce(p ->> 'position', ''), nullif(p ->> 'joinDate', '')::date,
          coalesce((p ->> 'annualLeave')::numeric, 15), left(coalesce(trim(p ->> 'phone'), ''), 20), _token(12))
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
    annual_leave = coalesce((p ->> 'annualLeave')::numeric, annual_leave),
    phone        = case when p ? 'phone' then left(coalesce(trim(p ->> 'phone'), ''), 20) else phone end
  where id = p_id;
  if not found then raise exception '직원을 찾을 수 없습니다.'; end if;
  -- A deactivated employee is signed out everywhere.
  if (p ->> 'active')::boolean is false then delete from emp_sessions where emp_id = p_id; end if;
end $$;

-- Check after running (should return true, true):
-- select exists (select 1 from information_schema.columns where table_name = 'employees' and column_name = 'phone') as has_phone,
--        position('linkUsedAt' in pg_get_functiondef('_employee_json(employees)'::regprocedure)) > 0 as json_has_link_status;
