-- 2026-10-09: employee links work only for the first device that opens them.
-- Safe to run more than once. Run in Supabase → SQL Editor.
--
-- After the first open, the link is marked used and any other device gets an error.
-- That device stays signed in. A new device needs a new link (admin: 직원 관리 → 새 링크).

alter table employees add column if not exists link_used_at timestamptz;

create or replace function emp_enter(p_link text) returns json
language plpgsql security definer set search_path = public as $$
declare e employees; t text := _token(32);
begin
  select * into e from employees where link_token = p_link for update;
  if e.id is null then raise exception '링크가 올바르지 않거나 만료되었습니다. 관리자에게 새 링크를 요청하세요.'; end if;
  if not e.active then raise exception '사용이 중지된 계정입니다. 관리자에게 문의하세요.'; end if;
  if e.link_used_at is not null then raise exception '이미 사용된 링크입니다. 관리자에게 새 링크를 요청하세요.'; end if;
  update employees set link_used_at = now() where id = e.id;
  insert into emp_sessions (token, emp_id) values (t, e.id);
  return json_build_object('session', t, 'user', _user_json(e));
end $$;

-- A new link makes the old one unusable and opens the link for one new first device.
create or replace function admin_regenerate_link(p_session text, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare t text := _token(12);
begin
  perform _admin(p_session);
  update employees set link_token = t, link_used_at = null where id = p_id;
  if not found then raise exception '직원을 찾을 수 없습니다.'; end if;
  delete from emp_sessions where emp_id = p_id;
  return t;
end $$;
