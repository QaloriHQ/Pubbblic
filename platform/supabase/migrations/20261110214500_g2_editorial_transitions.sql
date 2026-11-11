-- G2 editorial integrity and server-enforced release transitions.
create or replace function public.release_integrity(p_release_id uuid)
returns table(check_id text,severity text,flagged boolean,description text)
language sql stable security invoker set search_path=''
as $$
 select v.check_id,v.severity,v.flagged,v.description
 from public.press_releases r
 cross join lateral (values
  ('placeholders'::text,'hold'::text,
    (r.headline||' '||r.summary||' '||r.body||' '||r.issuer) ~*
      '(lorem ipsum|\mTODO\M|\mTBD\M|\[insert[^\]]*\]|\[company name\]|example\.invalid)',
    'Replace placeholders and unverified sample facts'::text),
  ('attribution'::text,'hold'::text,
    btrim(r.quote_text)<>'' and btrim(r.quote_attribution)='',
    'Quotes require an identified, authorized attribution'::text),
  ('unverified_claims'::text,'review'::text,
    (r.headline||' '||r.summary||' '||r.body) ~*
      '(guaranteed returns|risk[- ]free investment|cures (all|every)|officially endorsed by the government)',
    'High-stakes claims require a human evidence review and documented rationale'::text)
 ) as v(check_id,severity,flagged,description)
 where r.id=p_release_id and (select auth.uid()) is not null
$$;
revoke all on function public.release_integrity(uuid) from public,anon;
grant execute on function public.release_integrity(uuid) to authenticated;

create or replace function private.guard_release_insert()
returns trigger language plpgsql security definer set search_path=''
as $$
declare other_org uuid;other_status text;
begin
 if new.status<>'draft' or new.version<>1 then raise exception 'new_release_must_be_draft'; end if;
 if new.corrects_release_id is not null then
  select organization_id,status into other_org,other_status from public.press_releases
    where id=new.corrects_release_id;
  if other_org is distinct from new.organization_id or other_status not in ('approved','withdrawn')
    then raise exception 'correction_requires_approved_release_in_same_org'; end if;
 end if;
 new.review_policy_version=null;new.review_requires_independent=null;
 new.review_submitted_at=null;new.review_submitted_by=null;
 new.approved_at=null;new.approved_by=null;new.approved_version=null;
 new.editorial_note='';
 if new.scheduled_for is not null and new.scheduled_for<=now() then
   raise exception 'scheduled_time_must_be_future'; end if;
 return new;
end $$;
drop trigger if exists releases_create_guard on public.press_releases;
create trigger releases_create_guard before insert on public.press_releases
 for each row execute function private.guard_release_insert();

create or replace function private.enforce_release_update()
returns trigger language plpgsql security definer set search_path=''
as $$
declare actor_role text; policy_ver int; independent bool;
        failed_checks integer; flagged_holds integer; flagged_reviews integer;
        content_changed boolean;
begin
 if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
 or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
 or new.corrects_release_id is distinct from old.corrects_release_id then
   raise exception 'immutable_release_identity'; end if;
 if new.version<>old.version+1 then raise exception 'version_conflict'; end if;
 select m.role into actor_role from public.organization_memberships m
 where m.organization_id=old.organization_id and m.user_id=(select auth.uid());
 if actor_role not in ('owner','admin','editor') then raise exception 'editor_role_required'; end if;
 if new.scheduled_for is not null and new.scheduled_for<=now() then
   raise exception 'scheduled_time_must_be_future'; end if;

 content_changed = row(new.headline,new.summary,new.issuer,new.dateline,new.category,
   new.body,new.body_format,new.quote_text,new.quote_attribution,new.boilerplate,
   new.contact_name,new.contact_email,new.archived_at,new.scheduled_for,new.schedule_timezone)
   is distinct from row(old.headline,old.summary,old.issuer,old.dateline,old.category,
   old.body,old.body_format,old.quote_text,old.quote_attribution,old.boilerplate,
   old.contact_name,old.contact_email,old.archived_at,old.scheduled_for,old.schedule_timezone);

 if new.status=old.status then
   if old.status not in ('draft','changes_requested') then
     raise exception 'locked_release_cannot_be_modified'; end if;
   if row(new.review_policy_version,new.review_requires_independent,
      new.review_submitted_at,new.review_submitted_by,new.approved_at,
      new.approved_by,new.approved_version,new.editorial_note)
     is distinct from
      row(old.review_policy_version,old.review_requires_independent,
      old.review_submitted_at,old.review_submitted_by,old.approved_at,
      old.approved_by,old.approved_version,old.editorial_note)
   then raise exception 'editorial_fields_server_owned'; end if;
 else
   if content_changed then raise exception 'save_content_before_status_transition'; end if;
   if old.status in ('draft','changes_requested') and new.status='ready_for_review' then
     select count(*) into failed_checks from public.release_readiness(old.id) c where not c.passed;
     if failed_checks>0 then raise exception 'release_readiness_incomplete'; end if;
     select count(*) into flagged_holds from public.release_integrity(old.id) v
       where v.flagged and v.severity='hold';
     if flagged_holds>0 then raise exception 'release_contains_placeholders_or_missing_attribution'; end if;
     select a.policy_version,a.separation_of_duties into policy_ver,independent
       from public.organization_approval_settings a where a.organization_id=old.organization_id;
     new.review_policy_version=coalesce(policy_ver,1);
     new.review_requires_independent=coalesce(independent,true);
     new.review_submitted_at=now();new.review_submitted_by=auth.uid();
     new.approved_at=null;new.approved_by=null;new.approved_version=null;new.editorial_note='';
   elsif old.status='ready_for_review' and new.status in ('approved','changes_requested') then
     if actor_role not in ('owner','admin') then raise exception 'approver_role_required'; end if;
     if coalesce(old.review_requires_independent,true) and
       (auth.uid()=old.created_by or auth.uid()=old.review_submitted_by) then
       raise exception 'independent_reviewer_required'; end if;
     if new.status='changes_requested' then
       if length(btrim(new.editorial_note))<10 then raise exception 'revision_reason_required'; end if;
       new.approved_by=null;new.approved_at=null;new.approved_version=null;
     else
       select count(*) into flagged_holds from public.release_integrity(old.id) v
         where v.flagged and v.severity='hold';
       if flagged_holds>0 then raise exception 'content_integrity_hold'; end if;
       select count(*) into flagged_reviews from public.release_integrity(old.id) v
         where v.flagged and v.severity='review';
       if flagged_reviews>0 and length(btrim(new.editorial_note))<20 then
         raise exception 'human_override_reason_required'; end if;
       if old.scheduled_for is not null and old.scheduled_for<=now() then
         raise exception 'scheduled_time_has_passed'; end if;
       new.approved_by=auth.uid();new.approved_at=now();new.approved_version=new.version;
     end if;
   elsif old.status='ready_for_review' and new.status='draft' then
     if new.editorial_note is distinct from old.editorial_note then
       raise exception 'review_note_not_permitted'; end if;
   elsif old.status='approved' and new.status='withdrawn' then
     if actor_role not in ('owner','admin') then raise exception 'approver_role_required'; end if;
     if length(btrim(new.editorial_note))<10 then raise exception 'withdrawal_reason_required'; end if;
     new.approved_at=old.approved_at;new.approved_by=old.approved_by;
     new.approved_version=old.approved_version;
   elsif old.status='changes_requested' and new.status='draft' then
     if new.editorial_note is distinct from old.editorial_note then
       raise exception 'editorial_note_immutable'; end if;
   else raise exception 'invalid_editorial_transition'; end if;
 end if;
 new.updated_at=now(); return new;
end $$;

create or replace function private.audit_editorial_transition()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status is distinct from old.status then
  insert into public.editorial_actions(organization_id,release_id,actor_id,version,
      from_status,to_status,note,policy_version)
  values(new.organization_id,new.id,auth.uid(),new.version,
      old.status,new.status,new.editorial_note,new.review_policy_version);
 end if;
 return new;
end $$;
drop trigger if exists releases_editorial_audit on public.press_releases;
create trigger releases_editorial_audit after update on public.press_releases
 for each row execute function private.audit_editorial_transition();

drop policy if exists releases_authorized_update on public.press_releases;
create policy releases_authorized_update on public.press_releases
 for update to authenticated
 using(private.can_edit(organization_id) and status in
  ('draft','changes_requested','ready_for_review','approved'))
 with check(private.can_edit(organization_id) and status in
  ('draft','changes_requested','ready_for_review','approved','withdrawn'));

create or replace function public.create_release_correction(p_release_id uuid)
returns uuid language plpgsql security invoker set search_path=''
as $$
declare r public.press_releases%rowtype;new_id uuid;
begin
 select * into r from public.press_releases where id=p_release_id and status in ('approved','withdrawn');
 if not found then raise exception 'approved_release_required'; end if;
 if not private.can_edit(r.organization_id) then raise exception 'editor_role_required'; end if;
 insert into public.press_releases(organization_id,created_by,headline,summary,issuer,dateline,
   category,body,body_format,quote_text,quote_attribution,boilerplate,
   contact_name,contact_email,status,version,corrects_release_id)
 values(r.organization_id,auth.uid(),'Correction: '||left(r.headline,128),r.summary,r.issuer,r.dateline,
   r.category,r.body,r.body_format,r.quote_text,r.quote_attribution,r.boilerplate,
   r.contact_name,r.contact_email,'draft',1,r.id)
 returning id into new_id;
 return new_id;
end $$;
revoke all on function public.create_release_correction(uuid) from public,anon;
grant execute on function public.create_release_correction(uuid) to authenticated;
