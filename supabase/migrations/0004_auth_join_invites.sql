-- Module 1: signup is always a customer; company/supplier accounts only via approved join request or invitation.

-- 1) signup can never choose a privileged account type
create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, account_type, full_name) values (new.id, 'customer', new.raw_user_meta_data->>'full_name');
  return new;
end $$;

-- 2) no self-service creation of profiles, organizations or memberships through the API
drop policy profiles_insert on public.profiles;       revoke insert on public.profiles from authenticated;
drop policy orgs_insert on public.organizations;      revoke insert on public.organizations from authenticated;
drop policy mem_insert on public.memberships;         revoke insert on public.memberships from authenticated;

-- 3) platform administrators (managed only in the database, never through the API)
create table public.platform_admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;
create policy pa_self on public.platform_admins for select to authenticated using (user_id = (select auth.uid()));
create function private.is_platform_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
grant execute on function private.is_platform_admin() to authenticated;

-- 4) join requests (company / supplier)
create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind public.org_type not null,
  org_name text not null check (length(org_name) between 2 and 120),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  org_id uuid references public.organizations(id),
  created_at timestamptz not null default now()
);
create unique index join_requests_one_pending on public.join_requests (user_id) where status = 'pending';
alter table public.join_requests enable row level security;
revoke all on public.join_requests from anon, authenticated;
grant select on public.join_requests to authenticated;
grant insert (kind, org_name, details) on public.join_requests to authenticated;
create policy jr_select on public.join_requests for select to authenticated using (user_id = (select auth.uid()) or private.is_platform_admin());
create policy jr_insert on public.join_requests for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');

create function public.review_join_request(req uuid, approve boolean, note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.join_requests; o uuid;
begin
  if not private.is_platform_admin() then raise exception 'not allowed'; end if;
  select * into r from public.join_requests where id = req and status = 'pending' for update;
  if not found then raise exception 'request not found or already reviewed'; end if;
  if approve then
    insert into public.organizations (type, name, created_by) values (r.kind, r.org_name, r.user_id) returning id into o;
    update public.profiles set account_type = (case r.kind when 'company' then 'company' else 'supplier' end)::public.account_type where id = r.user_id;
    update public.join_requests set status='approved', reviewed_by=(select auth.uid()), reviewed_at=now(), review_note=note, org_id=o where id = req;
    return o;
  end if;
  update public.join_requests set status='rejected', reviewed_by=(select auth.uid()), reviewed_at=now(), review_note=note where id = req;
  return null;
end $$;

-- 5) invitations into an existing organization
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (length(email) between 5 and 254),
  role public.member_role not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null default auth.uid() references auth.users(id),
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create unique index org_invites_one_pending on public.org_invites (org_id, email) where status = 'pending';
create function private.lower_invite_email() returns trigger language plpgsql set search_path = '' as $$
begin new.email := lower(trim(new.email)); return new; end $$;
create trigger org_invites_lower before insert on public.org_invites for each row execute function private.lower_invite_email();
alter table public.org_invites enable row level security;
revoke all on public.org_invites from anon, authenticated;
grant select on public.org_invites to authenticated;
grant insert (org_id, email, role) on public.org_invites to authenticated;
grant update (status) on public.org_invites to authenticated;
create policy oi_select on public.org_invites for select to authenticated using (
  private.is_member(org_id, array['admin']::public.member_role[]) or email = lower((select auth.jwt()->>'email')));
create policy oi_insert on public.org_invites for insert to authenticated with check (
  private.is_member(org_id, array['admin']::public.member_role[]) and invited_by = (select auth.uid()) and status = 'pending');
create policy oi_revoke on public.org_invites for update to authenticated using (private.is_member(org_id, array['admin']::public.member_role[])) with check (status = 'revoked');

create function public.accept_org_invite(inv uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i public.org_invites; mail text; t public.org_type;
begin
  select email into mail from auth.users where id = (select auth.uid()) and email_confirmed_at is not null;
  if mail is null then raise exception 'confirmed email required'; end if;
  select * into i from public.org_invites where id = inv and status = 'pending' and expires_at > now() and email = lower(mail) for update;
  if not found then raise exception 'invitation not found, expired or not addressed to you'; end if;
  insert into public.memberships (org_id, user_id, role) values (i.org_id, (select auth.uid()), i.role)
    on conflict (org_id, user_id) do update set role = excluded.role;
  select type into t from public.organizations where id = i.org_id;
  update public.profiles set account_type = (case t when 'company' then 'company' else 'supplier' end)::public.account_type where id = (select auth.uid());
  update public.org_invites set status = 'accepted' where id = inv;
  return i.org_id;
end $$;

-- 6) administrative assignment of a requested project to an installing company
create function public.assign_project(p uuid, o uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.organizations where id = o and type = 'company') then raise exception 'not a company'; end if;
  if not exists (select 1 from public.projects where id = p and status in ('requested','assigned')) then raise exception 'project not requestable'; end if;
  perform set_config('app.bypass_guard','1',true);
  update public.projects set org_id = o, status = 'assigned' where id = p;
  perform set_config('app.bypass_guard','',true);
  insert into public.project_invites (project_id, org_id, status) values (p, o, 'accepted') on conflict (project_id, org_id) do update set status = 'accepted';
  insert into public.project_events (project_id, actor, kind, payload) values (p, (select auth.uid()), 'assigned_by_admin', jsonb_build_object('org_id', o));
end $$;

revoke execute on function public.review_join_request(uuid, boolean, text), public.accept_org_invite(uuid), public.assign_project(uuid, uuid) from public, anon;
grant execute on function public.review_join_request(uuid, boolean, text), public.accept_org_invite(uuid), public.assign_project(uuid, uuid) to authenticated;

-- 7) platform administrators can triage requested projects (never drafts) and see organizations
create policy proj_select_admin on public.projects for select to authenticated using (private.is_platform_admin() and status <> 'draft');
create policy orgs_select_admin on public.organizations for select to authenticated using (private.is_platform_admin());
create policy profiles_select_admin on public.profiles for select to authenticated using (private.is_platform_admin());

-- 8) idempotent migration of browser projects
alter table public.projects add column local_id text;
create unique index projects_local_id on public.projects (customer_id, local_id) where local_id is not null;
