create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  college_name text not null check (char_length(trim(college_name)) between 1 and 160),
  project_code text not null check (char_length(trim(project_code)) between 1 and 80),
  academic_year text not null check (char_length(trim(academic_year)) between 1 and 32),
  passing_year text,
  student_count integer not null default 0 check (student_count >= 0),
  cost_per_student numeric(14, 2) not null default 0 check (cost_per_student >= 0),
  total_cost_value numeric(14, 2) not null default 0 check (total_cost_value >= 0),
  gst_cost numeric(14, 2) not null default 0 check (gst_cost >= 0),
  phases jsonb not null default '[{"phase":"Phase 1","startDate":"","endDate":""}]'::jsonb check (jsonb_typeof(phases) = 'array'),
  hours_planned numeric(10, 2) not null default 0 check (hours_planned >= 0),
  hours_given numeric(10, 2) not null default 0 check (hours_given >= 0),
  training_cost numeric(14, 2) not null default 0 check (training_cost >= 0),
  payment_type text not null default 'FNF' check (payment_type in ('FNF', 'ATP', 'ATTP', 'EMI')),
  invoice_count integer not null default 1 check (invoice_count between 1 and 10),
  invoice_raised numeric(14, 2) not null default 0 check (invoice_raised >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_org_updated_idx on public.projects (org_id, updated_at desc);
create index if not exists organization_members_user_idx on public.organization_members (user_id);
create unique index if not exists projects_org_code_lower_idx on public.projects (org_id, lower(project_code));

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);

create or replace function public.is_organization_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'Workspace name must be 1 to 80 characters'; end if;
  insert into public.organizations (name, created_by) values (trim(p_name), auth.uid()) returning id into new_org_id;
  insert into public.organization_members (org_id, user_id, role) values (new_org_id, auth.uid(), 'owner');
  return new_org_id;
end;
$$;

create or replace function public.create_org_invite(p_org_id uuid, p_token_hash text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_organization_member(p_org_id) then raise exception 'Workspace membership is required'; end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invite token'; end if;
  insert into public.organization_invites (org_id, token_hash, created_by, expires_at)
  values (p_org_id, p_token_hash, auth.uid(), now() + interval '7 days');
end;
$$;

create or replace function public.accept_org_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invite_row public.organization_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select * into invite_row from public.organization_invites
  where token_hash = p_token_hash and expires_at > now() and accepted_at is null
  for update;
  if not found then raise exception 'Invite is invalid, expired or already used'; end if;
  insert into public.organization_members (org_id, user_id, role)
  values (invite_row.org_id, auth.uid(), 'member')
  on conflict (org_id, user_id) do nothing;
  update public.organization_invites set accepted_at = now(), accepted_by = auth.uid() where id = invite_row.id;
  return invite_row.org_id;
end;
$$;

create or replace function public.touch_project_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_project_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.organization_invites enable row level security;

grant usage on schema public to authenticated;
revoke all on public.organizations, public.organization_members, public.projects from anon;
grant select on public.organizations, public.organization_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;

drop policy if exists "Members can view their organizations" on public.organizations;
create policy "Members can view their organizations" on public.organizations
for select to authenticated using (public.is_organization_member(id));

drop policy if exists "Members can view workspace membership" on public.organization_members;
create policy "Members can view workspace membership" on public.organization_members
for select to authenticated using (public.is_organization_member(org_id));

drop policy if exists "Members can read projects" on public.projects;
create policy "Members can read projects" on public.projects
for select to authenticated using (public.is_organization_member(org_id));

drop policy if exists "Members can add projects" on public.projects;
create policy "Members can add projects" on public.projects
for insert to authenticated with check (public.is_organization_member(org_id) and created_by = (select auth.uid()));

drop policy if exists "Members can update projects" on public.projects;
create policy "Members can update projects" on public.projects
for update to authenticated using (public.is_organization_member(org_id)) with check (public.is_organization_member(org_id));

drop policy if exists "Members can delete projects" on public.projects;
create policy "Members can delete projects" on public.projects
for delete to authenticated using (public.is_organization_member(org_id));

revoke all on public.organization_invites from anon, authenticated;
revoke all on function public.is_organization_member(uuid) from public, anon;
revoke all on function public.create_organization(text) from public, anon;
revoke all on function public.create_org_invite(uuid, text) from public, anon;
revoke all on function public.accept_org_invite(text) from public, anon;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.create_org_invite(uuid, text) to authenticated;
grant execute on function public.accept_org_invite(text) to authenticated;