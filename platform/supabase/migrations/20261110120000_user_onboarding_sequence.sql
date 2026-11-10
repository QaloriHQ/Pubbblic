-- New users must set a password before organization onboarding. Existing pilot users
-- are grandfathered to preserve in-progress QA memberships and releases.
create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_set_at timestamptz,
  invitations_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;

grant select on public.user_onboarding to authenticated;
revoke insert, update, delete on public.user_onboarding from anon, authenticated;

drop policy if exists "pubbblic_read_own_onboarding" on public.user_onboarding;
create policy "pubbblic_read_own_onboarding" on public.user_onboarding
  for select to authenticated using (user_id=(select auth.uid()));

-- Only trusted server code may mark the password step. This trigger creates a
-- record for a newly invited/registered account, but NEVER marks its password set.
create or replace function private.initialize_user_onboarding()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.user_onboarding(user_id) values(new.id)
  on conflict(user_id) do nothing;
  return new;
end $$;

revoke all on function private.initialize_user_onboarding() from public, anon, authenticated;
drop trigger if exists pubbblic_auth_user_onboarding on auth.users;
create trigger pubbblic_auth_user_onboarding
after insert on auth.users for each row
execute function private.initialize_user_onboarding();

-- Existing QA accounts are not retroactively forced to set a new password.
insert into public.user_onboarding(user_id,password_set_at,invitations_reviewed_at)
select id,now(),now() from auth.users
on conflict(user_id) do nothing;

create or replace function private.complete_user_onboarding_invitations()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.user_onboarding
                where user_id=v_user and password_set_at is not null)
    then raise exception 'set_password_first'; end if;
  if not exists(select 1 from public.organization_memberships
                where user_id=v_user)
    then raise exception 'join_or_create_organization_first'; end if;
  update public.user_onboarding
  set invitations_reviewed_at=coalesce(invitations_reviewed_at,now())
  where user_id=v_user;
end $$;
revoke all on function private.complete_user_onboarding_invitations() from public,anon,authenticated;
create or replace function public.complete_onboarding_invitations()
returns void language sql set search_path = ''
as $$select private.complete_user_onboarding_invitations();$$;
revoke all on function public.complete_onboarding_invitations() from public,anon;
grant execute on function public.complete_onboarding_invitations() to authenticated;
