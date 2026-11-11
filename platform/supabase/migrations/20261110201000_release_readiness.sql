-- PUB-03.01: shared database readiness rules.
-- Drafts remain intentionally partial/autosavable; publication approval is future G2 work.
-- Runs as the caller under RLS. No SECURITY DEFINER or cross-tenant access.
create or replace function public.release_readiness(p_release_id uuid)
returns table(check_id text,passed boolean,criteria text)
language sql stable security invoker set search_path=''
as $$
  select v.check_id,v.passed,v.criteria
  from public.press_releases r
  cross join lateral (values
    ('headline'::text, char_length(btrim(r.headline)) between 15 and 140, 'Headline: 15–140 characters'::text),
    ('summary'::text, char_length(btrim(r.summary)) between 35 and 320, 'Summary: 35–320 characters'::text),
    ('issuer'::text, char_length(btrim(r.issuer)) >= 2, 'Identifiable organization / issuer'::text),
    ('dateline'::text, char_length(btrim(r.dateline)) >= 8, 'Dateline includes city and announcement date'::text),
    ('body'::text, btrim(r.body)<>'' and cardinality(regexp_split_to_array(btrim(r.body), E'\\s+'))>=60, 'At least 60 substantive words'::text),
    ('contact'::text, char_length(btrim(r.contact_name))>=2 and r.contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$', 'Media contact and valid email'::text),
    ('quote'::text, btrim(r.quote_text)='' or char_length(btrim(r.quote_attribution))>=3, 'Any quote has an attribution'::text)
  ) as v(check_id,passed,criteria)
  where r.id=p_release_id and (select auth.uid()) is not null
$$;
revoke all on function public.release_readiness(uuid) from public,anon;
grant execute on function public.release_readiness(uuid) to authenticated;
comment on function public.release_readiness(uuid) is 'Readiness guidance only; never an automatic publisher approval.';
