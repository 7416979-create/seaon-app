-- 2026-10-12: 출퇴근 N분 전 푸시 알림 (7차, 기본 30분). Written by the lead; do not edit.
-- Safe to run more than once. Run AFTER 2026-10-11-fixes-holidays-backup.sql.
-- Does not change existing rows. Adds two tables, employee push APIs, and server-only helpers
-- that the Edge Function "push-reminders" calls with the service role.
-- The VAPID keys and the cron secret are NOT in this file: the owner adds them to Vault
-- (claude-work/push-setup-owner.sql, never committed).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Tables ─────────────────────────────────────────────────────────────

-- One row per device that turned notifications on. Deleted with the employee.
create table if not exists push_subscriptions (
  endpoint     text primary key,
  emp_id       uuid not null references employees(id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz,
  fail_count   int not null default 0
);
create index if not exists push_subscriptions_emp_idx on push_subscriptions(emp_id);
alter table push_subscriptions enable row level security;

-- One reminder per employee per day per kind, even if cron runs overlap.
create table if not exists push_log (
  emp_id    uuid not null references employees(id) on delete cascade,
  work_date date not null,
  kind      text not null check (kind in ('in', 'out')),
  sent_at   timestamptz not null default now(),
  primary key (emp_id, work_date, kind)
);
alter table push_log enable row level security;

revoke all on table push_subscriptions, push_log from anon, authenticated;

-- ── Employee API ───────────────────────────────────────────────────────

-- p_sub is PushSubscription.toJSON(): { endpoint, keys: { p256dh, auth } }
create or replace function emp_push_subscribe(p_session text, p_sub jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e employees := _emp(p_session);
begin
  if coalesce(p_sub ->> 'endpoint', '') !~ '^https://' or p_sub #>> '{keys,p256dh}' is null or p_sub #>> '{keys,auth}' is null then
    raise exception '알림 등록 정보가 올바르지 않습니다.';
  end if;
  insert into push_subscriptions (endpoint, emp_id, p256dh, auth)
  values (p_sub ->> 'endpoint', e.id, p_sub #>> '{keys,p256dh}', p_sub #>> '{keys,auth}')
  on conflict (endpoint) do update
    set emp_id = excluded.emp_id, p256dh = excluded.p256dh, auth = excluded.auth, fail_count = 0;
end $$;

create or replace function emp_push_unsubscribe(p_session text, p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
declare e employees := _emp(p_session);
begin
  delete from push_subscriptions where endpoint = p_endpoint and emp_id = e.id;
end $$;

-- Is this device registered for this employee?
create or replace function emp_push_status(p_session text, p_endpoint text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare e employees := _emp(p_session);
begin
  return exists (select 1 from push_subscriptions where endpoint = p_endpoint and emp_id = e.id);
end $$;

-- ── Server-only helpers (service role; called by the Edge Function) ─────

-- Checks the cron secret and returns the VAPID details from Vault.
create or replace function push_config(p_secret text) returns json
language plpgsql stable security definer set search_path = public as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'push_cron_secret';
  if s is null or p_secret is distinct from s then
    raise exception 'forbidden';
  end if;
  return json_build_object(
    'publicKey',  (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
    'privateKey', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    'subject',    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_subject'));
end $$;

-- Reminders due at p_now (Korea time). Records each one in push_log so it is sent once a day.
-- Skips weekends, holidays, policy.pushReminder = false, approved leave, and people who already
-- checked in (출근 알림) or have not checked in / already checked out (퇴근 알림).
-- p_test_emp_no: test only, must start with TST. Real runs never include TST employees.
create or replace function push_due(p_now timestamptz default now(), p_test_emp_no text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  pol    jsonb := (select policy from settings where id = 1);
  local  timestamp := p_now at time zone 'Asia/Seoul';
  d      date := local::date;
  t      time := local::time;
  mins   int := greatest(5, least(120, coalesce((pol ->> 'pushMinutes')::int, 30)));
  t_in   time := coalesce(nullif(pol ->> 'workStart', ''), '09:00')::time;
  t_out  time := coalesce(nullif(pol ->> 'workEnd', ''), '18:00')::time;
  k      text;
  result json;
begin
  if p_test_emp_no is not null and p_test_emp_no not like 'TST%' then
    raise exception 'test runs are only allowed for TST employees';
  end if;
  if p_test_emp_no is null and coalesce((pol ->> 'pushReminder')::boolean, true) = false then
    return '[]'::json;
  end if;
  if extract(isodow from d) in (6, 7) or exists (select 1 from holidays where day = d) then
    return '[]'::json;
  end if;
  if t >= t_in - make_interval(mins => mins) and t < t_in then
    k := 'in';
  elsif t >= t_out - make_interval(mins => mins) and t < t_out then
    k := 'out';
  else
    return '[]'::json;
  end if;

  if p_test_emp_no is not null then
    delete from push_log l using employees e where l.emp_id = e.id and e.emp_no = p_test_emp_no and l.work_date = d;
  end if;

  with cand as (
    select e.id
    from employees e
    where e.active
      and (case when p_test_emp_no is null then e.emp_no not like 'TST%' else e.emp_no = p_test_emp_no end)
      and exists (select 1 from push_subscriptions s where s.emp_id = e.id)
      and not exists (
        select 1 from leave_requests r
        where r.emp_id = e.id and r.status = '승인'
          and d between r.start_date and coalesce(r.end_date, r.start_date)
          and (r.type = '연차'
               or (k = 'in' and r.type = '오전반차')
               or (k = 'out' and r.type in ('오후반차', '조퇴'))))
      and (case when k = 'in'
             then not exists (select 1 from attendance a where a.emp_id = e.id and a.work_date = d and a.check_in is not null)
             else exists (select 1 from attendance a where a.emp_id = e.id and a.work_date = d and a.check_in is not null and a.check_out is null)
           end)
  ), logged as (
    insert into push_log (emp_id, work_date, kind)
    select id, d, k from cand
    on conflict do nothing
    returning emp_id
  )
  select coalesce(json_agg(json_build_object(
           'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
           'title', case when k = 'in' then '출근 ' || mins || '분 전이에요' else '퇴근 ' || mins || '분 전이에요' end,
           'body', case when k = 'in'
                     then '오늘 출근 시각은 ' || to_char(t_in, 'HH24:MI') || '입니다. 도착하면 출근 버튼을 눌러 주세요.'
                     else '오늘 퇴근 시각은 ' || to_char(t_out, 'HH24:MI') || '입니다. 퇴근할 때 퇴근 버튼을 눌러 주세요.' end)), '[]'::json)
    into result
  from logged l join push_subscriptions s on s.emp_id = l.emp_id;
  return result;
end $$;

-- After each send: forget devices the push service says are gone (404/410), count other failures.
create or replace function push_result(p_endpoint text, p_ok boolean, p_gone boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_gone then
    delete from push_subscriptions where endpoint = p_endpoint;
  else
    update push_subscriptions
       set last_sent_at = case when p_ok then now() else last_sent_at end,
           fail_count   = case when p_ok then 0 else fail_count + 1 end
     where endpoint = p_endpoint;
  end if;
end $$;

-- ── Permissions ────────────────────────────────────────────────────────

revoke all on function push_config(text), push_due(timestamptz, text), push_result(text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function push_config(text), push_due(timestamptz, text), push_result(text, boolean, boolean)
  to service_role;

revoke all on function emp_push_subscribe(text, jsonb), emp_push_unsubscribe(text, text), emp_push_status(text, text)
  from public, authenticated;
grant execute on function emp_push_subscribe(text, jsonb), emp_push_unsubscribe(text, text), emp_push_status(text, text)
  to anon;

-- Check after running (expect: true, true, true, true, false, false):
-- select exists (select 1 from information_schema.tables where table_name = 'push_subscriptions') as subs_table,
--        exists (select 1 from information_schema.tables where table_name = 'push_log') as log_table,
--        exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') as extensions,
--        has_function_privilege('anon', 'emp_push_subscribe(text, jsonb)', 'execute') as subscribe_callable,
--        has_function_privilege('anon', 'push_due(timestamptz, text)', 'execute') as due_callable_by_anon,
--        has_function_privilege('anon', 'push_config(text)', 'execute') as config_callable_by_anon;
