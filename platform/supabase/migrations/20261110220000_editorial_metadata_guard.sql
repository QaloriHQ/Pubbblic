CREATE OR REPLACE FUNCTION private.enforce_release_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if new.scheduled_for is not null and new.scheduled_for<=now()
    and (new.scheduled_for is distinct from old.scheduled_for
         or old.status in ('draft','changes_requested')) then
   raise exception 'scheduled_time_must_be_future'; end if;

 -- Clients cannot forge review policy, approver identity or immutable approval snapshot.
 if row(new.review_policy_version,new.review_requires_independent,
    new.review_submitted_at,new.review_submitted_by,new.approved_at,
    new.approved_by,new.approved_version)
    is distinct from row(old.review_policy_version,old.review_requires_independent,
    old.review_submitted_at,old.review_submitted_by,old.approved_at,
    old.approved_by,old.approved_version) then
   raise exception 'editorial_metadata_server_owned'; end if;

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
end $function$
;
