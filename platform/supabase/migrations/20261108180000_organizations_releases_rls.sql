-- Pubbblic organization and release storage foundation, 2026-11-08.
-- Apply ONLY to a dedicated Pubbblic Supabase project. No cross-project data imports.
-- Migration is additive and leaves publisher integrations/payments disabled.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 2 and 120),
 slug text not null unique,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$')
);

create table if not exists public.organization_memberships (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','editor','viewer')),
 created_at timestamptz not null default now(),
 primary key (organization_id, user_id)
);
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id, organization_id);
create unique index if not exists organization_one_owner_idx on public.organization_memberships(organization_id) where role = 'owner';

create table if not exists public.organization_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 email text not null check (length(email) between 5 and 254 and email=lower(btrim(email))),
 role text not null check (role in ('admin','editor','viewer')),
 invited_by uuid not null references auth.users(id),
 invited_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '14 days'),
 accepted_at timestamptz,
 unique (organization_id,email)
);
create index if not exists org_invitation_email_idx on public.organization_invitations(email,expires_at) where accepted_at is null;

create table if not exists public.press_releases (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 created_by uuid not null references auth.users(id),
 headline text not null default '' check (length(headline)<=140),
 summary text not null default '' check (length(summary)<=320),
 issuer text not null default '' check (length(issuer)<=160),
 dateline text not null default '' check (length(dateline)<=180),
 category text not null default 'Company news' check(category in ('Product launch','Company news','Partnership','Milestone','Event','Other')),
 body text not null default '' check (length(body)<=100000),
 quote_text text not null default '' check(length(quote_text)<=5000),
 quote_attribution text not null default '' check(length(quote_attribution)<=500),
 boilerplate text not null default '' check(length(boilerplate)<=10000),
 contact_name text not null default '' check(length(contact_name)<=160),
 contact_email text not null default '' check(length(contact_email)<=254),
 status text not null default 'draft' check (status in ('draft','ready_for_review','changes_requested','approved','withdrawn')),
 version integer not null default 1 check (version>=1),
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists press_releases_org_recent_idx on public.press_releases(organization_id,updated_at desc);
create index if not exists press_releases_creator_idx on public.press_releases(created_by);

create table if not exists public.press_release_versions (
 id uuid primary key default gen_random_uuid(),
 release_id uuid not null references public.press_releases(id) on delete cascade,
 organization_id uuid not null references public.organizations(id),
 version integer not null,
 snapshot jsonb not null,
 actor_id uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(release_id,version)
);
create index if not exists press_release_versions_org_idx on public.press_release_versions(organization_id,release_id,version desc);

create table if not exists public.press_release_media (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 release_id uuid not null references public.press_releases(id) on delete cascade,
 object_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 255),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
 byte_size bigint not null check(byte_size between 1 and 10485760),
 uploaded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 check (split_part(object_path,'/',1)=organization_id::text
        and split_part(object_path,'/',2)=release_id::text)
);
create index if not exists press_release_media_release_idx on public.press_release_media(release_id);

-- Permission lookups live outside exposed schemas and never use mutable user_metadata.
create or replace function private.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.organization_memberships m
 where m.organization_id=p_org and m.user_id=(select auth.uid())
) $$;
create or replace function private.can_edit(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.organization_memberships m
 where m.organization_id=p_org and m.user_id=(select auth.uid())
 and m.role in ('owner','admin','editor')
) $$;
create or replace function private.is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.organization_memberships m
 where m.organization_id=p_org and m.user_id=(select auth.uid())
 and m.role in ('owner','admin')
) $$;
revoke all on function private.is_member(uuid), private.can_edit(uuid), private.is_admin(uuid) from public, anon;
grant execute on function private.is_member(uuid), private.can_edit(uuid), private.is_admin(uuid) to authenticated;

-- Atomic organization creation. The caller becomes the only owner.
create or replace function private.create_organization_impl(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_name text;
begin
 if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
 if not exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.email_confirmed_at is not null)
 then raise exception 'verified_email_required'; end if;
 v_name=btrim(p_name);
 if length(v_name) not between 2 and 120 then raise exception 'invalid_organization_name'; end if;
 insert into public.organizations(name,slug,created_by)
 values(v_name, left(coalesce(nullif(trim(both '-' from regexp_replace(lower(v_name),'[^a-z0-9]+','-','g')),''),'organization'),60)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8),(select auth.uid()))
 returning id into v_id;
 insert into public.organization_memberships(organization_id,user_id,role)
 values(v_id,(select auth.uid()),'owner');
 return v_id;
end $$;
create or replace function public.create_organization(p_name text)
returns uuid language sql security invoker set search_path = '' as $$
 select private.create_organization_impl(p_name);
$$;
revoke all on function private.create_organization_impl(text),public.create_organization(text) from public,anon;
grant execute on function private.create_organization_impl(text),public.create_organization(text) to authenticated;

create or replace function private.invite_member_impl(p_org uuid,p_email text,p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
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
 on conflict (organization_id,email) do update
 set role=excluded.role,invited_by=excluded.invited_by,
 invited_at=now(),expires_at=now()+interval '14 days',accepted_at=null
 returning id into v_id;
 return v_id;
end $$;
create or replace function public.invite_organization_member(p_organization_id uuid,p_email text,p_role text)
returns uuid language sql security invoker set search_path = '' as $$
 select private.invite_member_impl(p_organization_id,p_email,p_role);
$$;
revoke all on function private.invite_member_impl(uuid,text,text), public.invite_organization_member(uuid,text,text) from public,anon;
grant execute on function private.invite_member_impl(uuid,text,text), public.invite_organization_member(uuid,text,text) to authenticated;

create or replace function private.accept_invitation_impl(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid;v_email text;v_inv public.organization_invitations%rowtype;
begin
 if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
 select lower(u.email) into v_email from auth.users u
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null;
 if v_email is null then raise exception 'verified_email_required'; end if;
 select * into v_inv from public.organization_invitations
 where id=p_id and email=v_email and accepted_at is null and expires_at>now() for update;
 if not found then raise exception 'invitation_unavailable'; end if;
 insert into public.organization_memberships(organization_id,user_id,role)
 values(v_inv.organization_id,(select auth.uid()),v_inv.role)
 on conflict (organization_id,user_id) do nothing;
 update public.organization_invitations set accepted_at=now() where id=p_id;
 return v_inv.organization_id;
end $$;
create or replace function public.accept_organization_invitation(p_invitation_id uuid)
returns uuid language sql security invoker set search_path = '' as $$
 select private.accept_invitation_impl(p_invitation_id);
$$;
revoke all on function private.accept_invitation_impl(uuid),public.accept_organization_invitation(uuid) from public,anon;
grant execute on function private.accept_invitation_impl(uuid),public.accept_organization_invitation(uuid) to authenticated;

create or replace function private.my_invitations_impl()
returns table(invitation_id uuid,organization_name text,invited_role text,expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select i.id,o.name,i.role,i.expires_at
 from public.organization_invitations i
 join public.organizations o on o.id=i.organization_id
 join auth.users u on lower(u.email)=i.email
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null
   and i.accepted_at is null and i.expires_at>now()
$$;
create or replace function public.my_organization_invitations()
returns table(invitation_id uuid,organization_name text,invited_role text,expires_at timestamptz)
language sql stable security invoker set search_path = '' as $$
 select * from private.my_invitations_impl();
$$;
revoke all on function private.my_invitations_impl(),public.my_organization_invitations() from public,anon;
grant execute on function private.my_invitations_impl(),public.my_organization_invitations() to authenticated;

-- Releases: immutable organization/owner identity and explicit optimistic locking.
create or replace function private.enforce_release_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
   or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
   or new.status is distinct from old.status then
   raise exception 'immutable_release_identity_or_status';
 end if;
 if new.version<>old.version+1 then raise exception 'version_conflict'; end if;
 new.updated_at=now();
 return new;
end $$;
create or replace function private.capture_release_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.press_release_versions(release_id,organization_id,version,snapshot,actor_id)
 values(new.id,new.organization_id,new.version,to_jsonb(new),(select auth.uid()));
 return new;
end $$;
drop trigger if exists releases_enforce_update on public.press_releases;
create trigger releases_enforce_update before update on public.press_releases
for each row execute function private.enforce_release_update();
drop trigger if exists releases_revision on public.press_releases;
create trigger releases_revision after insert or update on public.press_releases
for each row execute function private.capture_release_version();
revoke all on function private.enforce_release_update(),private.capture_release_version() from public,anon,authenticated;

-- Private object storage: paths MUST be <organization uuid>/<release uuid>/<random key>.ext.
create or replace function private.asset_path_allowed(p_path text,p_write boolean)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;v_release uuid;v_bits text[];
begin
 v_bits=string_to_array(p_path,'/');
 if array_length(v_bits,1)<>3 or v_bits[1] !~
   '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or v_bits[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then return false; end if;
 v_org=v_bits[1]::uuid;v_release=v_bits[2]::uuid;
 if not exists(select 1 from public.press_releases r
   where r.organization_id=v_org and r.id=v_release and r.archived_at is null) then return false; end if;
 if p_write then return private.can_edit(v_org); end if;
 return private.is_member(v_org);
end $$;
revoke all on function private.asset_path_allowed(text,boolean) from public,anon;
grant execute on function private.asset_path_allowed(text,boolean) to authenticated;

-- RLS across ALL public tables.
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.press_releases enable row level security;
alter table public.press_release_versions enable row level security;
alter table public.press_release_media enable row level security;

create policy organizations_member_read on public.organizations
 for select to authenticated using (private.is_member(id));
create policy members_organization_read on public.organization_memberships
 for select to authenticated using (private.is_member(organization_id));
create policy invitations_admin_read on public.organization_invitations
 for select to authenticated using (private.is_admin(organization_id));

create policy releases_org_read on public.press_releases
 for select to authenticated using (private.is_member(organization_id));
create policy releases_authorized_insert on public.press_releases
 for insert to authenticated with check (
  created_by=(select auth.uid()) and status='draft' and version=1
  and private.can_edit(organization_id)
 );
create policy releases_authorized_update on public.press_releases
 for update to authenticated using (
  private.can_edit(organization_id) and status='draft'
 ) with check (
  private.can_edit(organization_id) and status='draft'
 );
create policy release_versions_org_read on public.press_release_versions
 for select to authenticated using (private.is_member(organization_id));

create policy media_org_read on public.press_release_media
 for select to authenticated using (private.is_member(organization_id));
create policy media_authorized_insert on public.press_release_media
 for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and private.can_edit(organization_id)
  and private.asset_path_allowed(object_path,true)
  and exists(select 1 from public.press_releases r where r.id=release_id and r.organization_id=press_release_media.organization_id)
 );

revoke all on public.organizations,public.organization_memberships,public.organization_invitations,
 public.press_releases,public.press_release_versions,public.press_release_media from anon;
revoke all on public.organizations,public.organization_memberships,public.organization_invitations,
 public.press_releases,public.press_release_versions,public.press_release_media from authenticated;
grant select on public.organizations,public.organization_memberships,public.organization_invitations,
 public.press_release_versions,public.press_release_media to authenticated;
grant select,insert,update on public.press_releases to authenticated;
grant insert on public.press_release_media to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('release-assets','release-assets',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
create policy pubbblic_release_assets_read on storage.objects
 for select to authenticated using (bucket_id='release-assets' and private.asset_path_allowed(name,false));
create policy pubbblic_release_assets_insert on storage.objects
 for insert to authenticated with check (bucket_id='release-assets' and private.asset_path_allowed(name,true));
-- No UPDATE, DELETE, or public access policies for the private bucket in this foundation.

-- Prevent arbitrary updates by client to the revision log.
revoke insert,update,delete on public.press_release_versions from anon,authenticated;
