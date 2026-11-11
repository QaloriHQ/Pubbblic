-- G2 approval policy and auditable content metadata.
create or replace function private.is_owner(p_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.organization_memberships
where organization_id=p_org and user_id=(select auth.uid()) and role='owner')$$;

create table if not exists public.organization_approval_settings (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 separation_of_duties boolean not null default true,
 policy_version integer not null default 1 check(policy_version>0),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.organization_approval_settings enable row level security;
revoke all on public.organization_approval_settings from anon,authenticated;
grant select,insert on public.organization_approval_settings to authenticated;
grant update(separation_of_duties) on public.organization_approval_settings to authenticated;
drop policy if exists approval_settings_member_read on public.organization_approval_settings;
create policy approval_settings_member_read on public.organization_approval_settings
 for select to authenticated using(private.is_member(organization_id));
drop policy if exists approval_settings_owner_insert on public.organization_approval_settings;
create policy approval_settings_owner_insert on public.organization_approval_settings
 for insert to authenticated with check(private.is_owner(organization_id));
drop policy if exists approval_settings_owner_update on public.organization_approval_settings;
create policy approval_settings_owner_update on public.organization_approval_settings
 for update to authenticated using(private.is_owner(organization_id))
 with check(private.is_owner(organization_id));

create or replace function private.version_approval_policy()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op='UPDATE' then
  if new.organization_id is distinct from old.organization_id then raise exception 'policy_org_immutable'; end if;
  if new.separation_of_duties is distinct from old.separation_of_duties
  then new.policy_version=old.policy_version+1;
  else new.policy_version=old.policy_version; end if;
 else new.policy_version=1; end if;
 new.updated_by=auth.uid();new.updated_at=now();
 return new;
end $$;
drop trigger if exists approval_policy_version_guard on public.organization_approval_settings;
create trigger approval_policy_version_guard before insert or update on public.organization_approval_settings
 for each row execute function private.version_approval_policy();

alter table public.press_releases
 add column if not exists review_policy_version integer,
 add column if not exists review_requires_independent boolean,
 add column if not exists review_submitted_at timestamptz,
 add column if not exists review_submitted_by uuid references auth.users(id),
 add column if not exists approved_at timestamptz,
 add column if not exists approved_by uuid references auth.users(id),
 add column if not exists approved_version integer,
 add column if not exists editorial_note text not null default '',
 add column if not exists scheduled_for timestamptz,
 add column if not exists schedule_timezone text not null default 'UTC',
 add column if not exists corrects_release_id uuid references public.press_releases(id);
do $$
begin
 if not exists(select 1 from pg_constraint where conname='release_schedule_timezone_size' and conrelid='public.press_releases'::regclass)
 then alter table public.press_releases add constraint release_schedule_timezone_size
      check(length(schedule_timezone) between 1 and 64); end if;
 if not exists(select 1 from pg_constraint where conname='release_editorial_note_size' and conrelid='public.press_releases'::regclass)
 then alter table public.press_releases add constraint release_editorial_note_size
      check(length(editorial_note)<=3000); end if;
end $$;
create index if not exists press_releases_review_queue_idx
 on public.press_releases(organization_id,updated_at desc) where status='ready_for_review';
create index if not exists press_releases_scheduled_idx
 on public.press_releases(scheduled_for) where status='approved' and scheduled_for is not null;

create table if not exists public.editorial_actions(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 release_id uuid not null references public.press_releases(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 version integer not null,
 from_status text not null,
 to_status text not null,
 note text not null default '',
 policy_version integer,
 created_at timestamptz not null default now(),
 unique(release_id,version)
);
create index if not exists editorial_actions_org_created on public.editorial_actions(organization_id,created_at desc);
alter table public.editorial_actions enable row level security;
revoke all on public.editorial_actions from anon,authenticated;
grant select on public.editorial_actions to authenticated;
drop policy if exists editorial_actions_org_read on public.editorial_actions;
create policy editorial_actions_org_read on public.editorial_actions
 for select to authenticated using(private.is_member(organization_id));
