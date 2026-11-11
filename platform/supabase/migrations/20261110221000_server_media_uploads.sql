-- G2 media: only authenticated trusted Edge worker may write private Storage or metadata.
alter table public.press_release_media
 add column if not exists sha256 text,
 add column if not exists validation_status text not null default 'pending',
 add column if not exists validated_at timestamptz;
do $$
begin
 if not exists(select 1 from pg_constraint where conname='media_validation_state_check' and conrelid='public.press_release_media'::regclass) then
  alter table public.press_release_media add constraint media_validation_state_check
  check(validation_status in ('pending','basic_validated','rejected'));
 end if;
 if not exists(select 1 from pg_constraint where conname='media_sha256_check' and conrelid='public.press_release_media'::regclass) then
  alter table public.press_release_media add constraint media_sha256_check
  check(sha256 is null or sha256~'^[0-9a-f]{64}$');
 end if;
end $$;
-- No direct client INSERT of metadata or raw file bytes; service-role Edge uploads only.
revoke insert,update,delete on public.press_release_media from anon,authenticated;
drop policy if exists media_authorized_insert on public.press_release_media;
drop policy if exists pubbblic_release_assets_insert on storage.objects;
-- Existing SELECT policies still authorize only organization members and scoped object paths.
comment on column public.press_release_media.validation_status is
 'basic_validated means signature/type/static PDF checks only; not antivirus clearance';
