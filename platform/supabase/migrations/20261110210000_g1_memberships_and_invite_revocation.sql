-- G1 identity/access: auditable member lifecycle, last-owner protection and revocable invitations.
alter table public.organization_invitations add column if not exists cancelled_at timestamptz;
create table if not exists public.organization_access_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  invitation_id uuid,
  event_type text not null check(event_type in ('role_changed','member_removed','invitation_cancelled')),
  before_role text,
  after_role text,
  created_at timestamptz not null default now()
);
create index if not exists organization_access_events_org_created on public.organization_access_events(organization_id,created_at desc);
alter table public.organization_access_events enable row level security;
revoke all on public.organization_access_events from anon,authenticated;
grant select on public.organization_access_events to authenticated;
drop policy if exists access_events_admin_read on public.organization_access_events;
create policy access_events_admin_read on public.organization_access_events
  for select to authenticated using (private.is_admin(organization_id));

-- Never let a client insert arbitrary memberships; invites remain the entrypoint.
revoke insert,update,delete on public.organization_memberships from anon,authenticated;
grant update(role),delete on public.organization_memberships to authenticated;
drop policy if exists memberships_authorized_update on public.organization_memberships;
create policy memberships_authorized_update on public.organization_memberships
  for update to authenticated using (private.is_admin(organization_id))
  with check (private.is_admin(organization_id));
drop policy if exists memberships_authorized_remove on public.organization_memberships;
create policy memberships_authorized_remove on public.organization_memberships
  for delete to authenticated using (private.is_admin(organization_id));

create or replace function private.guard_membership_mutation()
returns trigger language plpgsql security definer set search_path=''
as $$
declare actor_role text; remaining_owners integer;
begin
  -- Serialize edits to memberships of one organization to avoid racing the last-owner guard.
  perform 1 from public.organizations where id=old.organization_id for update;
  select m.role into actor_role from public.organization_memberships m
   where m.organization_id=old.organization_id and m.user_id=(select auth.uid());
  if actor_role not in ('owner','admin') then raise exception 'owner_or_admin_required'; end if;
  if tg_op='UPDATE' then
    if new.organization_id is distinct from old.organization_id or new.user_id is distinct from old.user_id
      or new.created_at is distinct from old.created_at then raise exception 'membership_identity_immutable'; end if;
    if new.role not in ('owner','admin','editor','viewer') then raise exception 'invalid_role'; end if;
    if new.role=old.role then return new; end if;
    if (old.role='owner' or new.role='owner') and actor_role<>'owner' then
      raise exception 'only_owner_can_transfer_ownership'; end if;
    if old.role='admin' and actor_role='admin' and old.user_id<>auth.uid() then
      raise exception 'admin_cannot_edit_peer_admin'; end if;
  else
    if old.role='owner' and actor_role<>'owner' then
      raise exception 'only_owner_can_remove_owner'; end if;
    if old.role='admin' and actor_role='admin' and old.user_id<>auth.uid() then
      raise exception 'admin_cannot_remove_peer_admin'; end if;
  end if;
  if old.role='owner' and (tg_op='DELETE' or new.role<>'owner') then
    select count(*) into remaining_owners from public.organization_memberships
      where organization_id=old.organization_id and role='owner' and user_id<>old.user_id;
    if remaining_owners<1 then raise exception 'last_owner_cannot_be_removed'; end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

create or replace function private.audit_membership_mutation()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op='UPDATE' and new.role=old.role then return new; end if;
 insert into public.organization_access_events(organization_id,actor_id,subject_user_id,event_type,before_role,after_role)
 values(old.organization_id,auth.uid(),old.user_id,
        case when tg_op='DELETE' then 'member_removed' else 'role_changed' end,
        old.role,case when tg_op='DELETE' then null else new.role end);
 return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists organization_membership_guard on public.organization_memberships;
create trigger organization_membership_guard before update or delete on public.organization_memberships
for each row execute function private.guard_membership_mutation();
drop trigger if exists organization_membership_audit on public.organization_memberships;
create trigger organization_membership_audit after update or delete on public.organization_memberships
for each row execute function private.audit_membership_mutation();

-- Revocation: clients may update only cancelled_at, never recipient, role or status.
revoke update on public.organization_invitations from anon,authenticated;
grant update(cancelled_at) on public.organization_invitations to authenticated;
drop policy if exists invitations_authorized_cancel on public.organization_invitations;
create policy invitations_authorized_cancel on public.organization_invitations
 for update to authenticated using (private.is_admin(organization_id))
 with check (private.is_admin(organization_id));
create or replace function private.audit_invitation_cancel()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if old.accepted_at is not null and new.cancelled_at is distinct from old.cancelled_at then
   raise exception 'already_accepted_invitation';
 end if;
 if old.cancelled_at is null and new.cancelled_at is not null then
   insert into public.organization_access_events(organization_id,actor_id,invitation_id,event_type)
   values(old.organization_id,auth.uid(),old.id,'invitation_cancelled');
 end if;
 return new;
end $$;
drop trigger if exists organization_invitation_cancel_audit on public.organization_invitations;
create trigger organization_invitation_cancel_audit before update of cancelled_at on public.organization_invitations
for each row execute function private.audit_invitation_cancel();

create or replace function private.accept_invitation_impl(p_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_email text;v_inv public.organization_invitations%rowtype;
begin
 if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
 select lower(u.email) into v_email from auth.users u
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null;
 if v_email is null then raise exception 'verified_email_required'; end if;
 select * into v_inv from public.organization_invitations
 where id=p_id and email=v_email and accepted_at is null
 and cancelled_at is null and expires_at>now() for update;
 if not found then raise exception 'invitation_unavailable'; end if;
 insert into public.organization_memberships(organization_id,user_id,role)
 values(v_inv.organization_id,(select auth.uid()),v_inv.role)
 on conflict(organization_id,user_id) do nothing;
 update public.organization_invitations set accepted_at=now() where id=p_id;
 return v_inv.organization_id;
end $$;

create or replace function private.invite_member_impl(p_org uuid,p_email text,p_role text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_email text;
begin
 if not private.is_admin(p_org) then raise exception 'permission_denied'; end if;
 v_email=lower(btrim(p_email));
 if length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 then raise exception 'invalid_email'; end if;
 if p_role not in ('admin','editor','viewer') then raise exception 'invalid_role'; end if;
 if exists(select 1 from public.organization_memberships m join auth.users u on u.id=m.user_id
   where m.organization_id=p_org and lower(u.email)=v_email) then raise exception 'already_member'; end if;
 insert into public.organization_invitations(organization_id,email,role,invited_by)
 values(p_org,v_email,p_role,(select auth.uid()))
 on conflict(organization_id,email) do update
 set role=excluded.role,invited_by=excluded.invited_by,
 invited_at=now(),expires_at=now()+interval '14 days',accepted_at=null,cancelled_at=null
 returning id into v_id;
 return v_id;
end $$;
