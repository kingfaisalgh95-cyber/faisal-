-- Shaqaf Energy · Module 0 · foundation: accounts, organizations, roles, projects, invites, quotes + row level security
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.account_type as enum ('customer','company','supplier');
create type public.org_type as enum ('company','supplier');
create type public.member_role as enum ('admin','engineer','technician','procurement');
create type public.project_status as enum ('draft','requested','assigned','quoted','accepted','in_progress','completed','cancelled');
create type public.quote_status as enum ('draft','sent','accepted','rejected','withdrawn');
create type public.invite_status as enum ('pending','accepted','declined');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type public.account_type not null default 'customer',
  full_name text, phone text,
  created_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.org_type not null,
  name text not null check (length(name) between 2 and 120),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references public.profiles(id),
  org_id uuid references public.organizations(id),
  name text not null check (length(name) between 1 and 120),
  status public.project_status not null default 'draft',
  inputs jsonb not null default '{}'::jsonb,        -- customer site data
  design_auto jsonb,                                -- customer automatic design (estimate)
  design_manual jsonb,                              -- engineer manual design (company only)
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.project_invites (
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (project_id, org_id)
);
create table public.project_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor uuid not null default auth.uid() references auth.users(id),
  kind text not null check (length(kind) between 1 and 60),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid not null references public.organizations(id),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'SAR',
  valid_until date,
  details jsonb not null default '{}'::jsonb,
  status public.quote_status not null default 'draft',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.memberships (user_id);
create index on public.projects (customer_id);
create index on public.projects (org_id);
create index on public.project_invites (org_id);
create index on public.project_events (project_id);
create index on public.quotes (project_id);
create index on public.quotes (org_id);

-- ---------- helpers (security definer, empty search_path) ----------
create function private.is_member(o uuid, roles public.member_role[] default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.org_id = o and m.user_id = (select auth.uid())
                 and (roles is null or m.role = any(roles)));
$$;
create function private.can_see_project(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects pr where pr.id = p and (
      pr.customer_id = (select auth.uid())
      or (pr.org_id is not null and private.is_member(pr.org_id))
      or exists (select 1 from public.project_invites i where i.project_id = pr.id and i.status <> 'declined' and private.is_member(i.org_id))
  ));
$$;
create function private.org_linked_to_my_project(o uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects pr where pr.customer_id = (select auth.uid())
    and (pr.org_id = o or exists (select 1 from public.project_invites i where i.project_id = pr.id and i.org_id = o)));
$$;
create function private.customer_of_visible_project(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects pr where pr.customer_id = c and private.can_see_project(pr.id));
$$;
grant execute on all functions in schema private to authenticated;

-- ---------- triggers ----------
create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare t text := coalesce(new.raw_user_meta_data->>'account_type','customer');
begin
  if t not in ('customer','company','supplier') then t := 'customer'; end if;
  insert into public.profiles (id, account_type, full_name) values (new.id, t::public.account_type, new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create function private.org_bootstrap() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.memberships (org_id, user_id, role) values (new.id, new.created_by, 'admin');
  return new;
end $$;
create trigger org_bootstrap after insert on public.organizations for each row execute function private.org_bootstrap();

create function private.touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); new.version := old.version + 1; return new; end $$;
create trigger projects_touch before update on public.projects for each row execute function private.touch();

-- who may change which project columns
create function private.guard_project() returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); is_owner boolean := (old.customer_id = uid);
        is_company boolean := (old.org_id is not null and private.is_member(old.org_id, array['admin','engineer']::public.member_role[]));
        invited boolean := exists (select 1 from public.project_invites i where i.project_id = old.id and i.status = 'accepted' and private.is_member(i.org_id, array['admin','engineer']::public.member_role[]));
begin
  if coalesce(current_setting('app.bypass_guard', true),'') = '1' then return new; end if;
  if new.customer_id <> old.customer_id then raise exception 'customer_id is immutable'; end if;
  if is_owner then
    if new.status <> old.status and new.status not in ('draft','requested','cancelled') then raise exception 'customers cannot set this status directly'; end if;
    if new.design_manual is distinct from old.design_manual then raise exception 'customers cannot edit the engineering design'; end if;
    if new.org_id is distinct from old.org_id then raise exception 'customers cannot assign a company directly'; end if;
    return new;
  end if;
  if is_company or invited then
    if new.inputs is distinct from old.inputs or new.design_auto is distinct from old.design_auto or new.name <> old.name then raise exception 'companies cannot edit customer data'; end if;
    if new.org_id is distinct from old.org_id and not (old.org_id is null and invited) then raise exception 'invalid company assignment'; end if;
    if new.status <> old.status and new.status not in ('assigned','quoted','in_progress','completed') then raise exception 'companies cannot set this status directly'; end if;
    return new;
  end if;
  raise exception 'not allowed';
end $$;
create trigger projects_guard before update on public.projects for each row execute function private.guard_project();

-- customers may only accept/reject a sent quote; nothing else
create function private.guard_quote() returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); cust uuid;
begin
  select customer_id into cust from public.projects where id = old.project_id;
  if cust = uid and not private.is_member(old.org_id) then
    if old.status <> 'sent' or new.status not in ('accepted','rejected')
       or new.amount <> old.amount or new.details is distinct from old.details or new.org_id <> old.org_id or new.project_id <> old.project_id then
      raise exception 'customers may only accept or reject a sent quote';
    end if;
  end if;
  return new;
end $$;
create trigger quotes_guard before update on public.quotes for each row execute function private.guard_quote();

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.project_invites enable row level security;
alter table public.project_events enable row level security;
alter table public.quotes enable row level security;
revoke all on all tables in schema public from anon;

create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()) or private.customer_of_visible_project(id));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy orgs_select on public.organizations for select to authenticated using (private.is_member(id) or private.org_linked_to_my_project(id));
create policy orgs_insert on public.organizations for insert to authenticated with check (created_by = (select auth.uid()));
create policy orgs_update on public.organizations for update to authenticated using (private.is_member(id, array['admin']::public.member_role[])) with check (private.is_member(id, array['admin']::public.member_role[]));

create policy mem_select on public.memberships for select to authenticated using (private.is_member(org_id));
create policy mem_insert on public.memberships for insert to authenticated with check (private.is_member(org_id, array['admin']::public.member_role[]));
create policy mem_update on public.memberships for update to authenticated using (private.is_member(org_id, array['admin']::public.member_role[])) with check (private.is_member(org_id, array['admin']::public.member_role[]));
create policy mem_delete on public.memberships for delete to authenticated using (private.is_member(org_id, array['admin']::public.member_role[]));

create policy proj_select on public.projects for select to authenticated using (private.can_see_project(id));
create policy proj_insert on public.projects for insert to authenticated with check (customer_id = (select auth.uid()) and org_id is null);
create policy proj_update on public.projects for update to authenticated using (private.can_see_project(id)) with check (private.can_see_project(id) or customer_id = (select auth.uid()));
create policy proj_delete on public.projects for delete to authenticated using (customer_id = (select auth.uid()) and status = 'draft');

create policy inv_select on public.project_invites for select to authenticated using (private.is_member(org_id) or exists (select 1 from public.projects p where p.id = project_id and p.customer_id = (select auth.uid())));
create policy inv_insert on public.project_invites for insert to authenticated with check (exists (select 1 from public.projects p where p.id = project_id and p.customer_id = (select auth.uid())));
create policy inv_update on public.project_invites for update to authenticated using (private.is_member(org_id, array['admin','engineer']::public.member_role[])) with check (private.is_member(org_id, array['admin','engineer']::public.member_role[]));
create policy inv_delete on public.project_invites for delete to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.customer_id = (select auth.uid())) and status = 'pending');

create policy ev_select on public.project_events for select to authenticated using (private.can_see_project(project_id));
create policy ev_insert on public.project_events for insert to authenticated with check (actor = (select auth.uid()) and private.can_see_project(project_id));

create policy q_select on public.quotes for select to authenticated using (
  private.is_member(org_id, array['admin','engineer']::public.member_role[])
  or (status <> 'draft' and exists (select 1 from public.projects p where p.id = project_id and p.customer_id = (select auth.uid()))));
create policy q_insert on public.quotes for insert to authenticated with check (
  private.is_member(org_id, array['admin','engineer']::public.member_role[]) and created_by = (select auth.uid())
  and exists (select 1 from public.projects p where p.id = project_id and (p.org_id = quotes.org_id or exists (select 1 from public.project_invites i where i.project_id = p.id and i.org_id = quotes.org_id and i.status = 'accepted'))));
create policy q_update on public.quotes for update to authenticated using (
  private.is_member(org_id, array['admin','engineer']::public.member_role[])
  or (status = 'sent' and exists (select 1 from public.projects p where p.id = project_id and p.customer_id = (select auth.uid()))))
  with check (true);

-- accepting a quote is the only path to the 'accepted' project status; it also fixes the assigned company
create function private.on_quote_accepted() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    perform set_config('app.bypass_guard','1',true);
    update public.projects set status = 'accepted', org_id = coalesce(org_id, new.org_id) where id = new.project_id;
    perform set_config('app.bypass_guard','',true);
    insert into public.project_events (project_id, actor, kind, payload) values (new.project_id, (select auth.uid()), 'quote_accepted', jsonb_build_object('quote_id', new.id, 'amount', new.amount));
  end if;
  return new;
end $$;
create trigger quotes_accepted after update on public.quotes for each row execute function private.on_quote_accepted();

-- column-level limits: keys and ownership columns can never be rewritten through the API
revoke update on public.project_invites from authenticated;
grant update (status) on public.project_invites to authenticated;
revoke update on public.memberships from authenticated;
grant update (role) on public.memberships to authenticated;
revoke update on public.quotes from authenticated;
grant update (status, amount, currency, valid_until, details) on public.quotes to authenticated;
revoke update on public.organizations from authenticated;
grant update (name) on public.organizations to authenticated;
revoke update on public.projects from authenticated;
grant update (name, status, inputs, design_auto, design_manual, org_id) on public.projects to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
