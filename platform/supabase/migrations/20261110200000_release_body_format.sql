-- PUB-03.01: opt-in Markdown body representation. Existing plain drafts stay intact.
-- Markdown is stored as source text and rendered as escaped React elements only;
-- arbitrary HTML is never interpreted by the public draft preview.
alter table public.press_releases
  add column if not exists body_format text not null default 'plain';
do $$
begin
  if not exists(select 1 from pg_constraint where conname='press_releases_body_format_check' and conrelid='public.press_releases'::regclass) then
    alter table public.press_releases add constraint press_releases_body_format_check
      check(body_format in ('plain','markdown'));
  end if;
end $$;
comment on column public.press_releases.body_format is
  'Authoring representation, plain or markdown. Render as escaped UI text; never execute HTML.';
create index if not exists press_release_versions_release_version_idx
  on public.press_release_versions(release_id,version desc);
