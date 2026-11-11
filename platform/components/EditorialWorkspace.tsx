"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {CheckCircleIcon,ShieldCheckIcon,ExclamationTriangleIcon,
  ClockIcon,ArrowPathIcon,DocumentTextIcon} from "@heroicons/react/24/outline";
import {createClient} from "@/lib/supabase/browser";

type Role="owner"|"admin"|"editor"|"viewer";
type ReleaseStatus="draft"|"ready_for_review"|"changes_requested"|"approved"|"withdrawn";
type Release={
  id:string;organization_id:string;headline:string;summary:string;issuer:string;
  created_by:string;status:ReleaseStatus;version:number;updated_at:string;
  review_submitted_by:string|null;review_requires_independent:boolean|null;
  review_policy_version:number|null;approved_version:number|null;
  approved_at:string|null;editorial_note:string;scheduled_for:string|null;
};
type ApprovalSetting={organization_id:string;separation_of_duties:boolean;policy_version:number};
type Audit={id:string;version:number;from_status:string;to_status:string;note:string;
  actor_id:string|null;created_at:string};
type Check={check_id:string;passed:boolean;criteria:string};
type Flag={check_id:string;severity:"hold"|"review";flagged:boolean;description:string};

const states:Record<ReleaseStatus,string>={
  draft:"Draft",ready_for_review:"Awaiting review",
  changes_requested:"Changes requested",approved:"Editorially approved",withdrawn:"Withdrawn"
};
const errorLabel=(e:unknown)=>{
  const message=e instanceof Error?e.message:String(e);
  const codes:Record<string,string>={
    independent_reviewer_required:"This release requires a different authorized approver. Ask another owner or admin to review it.",
    release_readiness_incomplete:"Complete the required editorial checks in the release editor before requesting review.",
    release_contains_placeholders_or_missing_attribution:"Replace sample placeholders and attribute all quotations before requesting review.",
    content_integrity_hold:"Editorial integrity checks flagged unresolved content. Review and correct the draft.",
    human_override_reason_required:"Provide an evidence-based reviewer explanation of at least 20 characters.",
    approver_role_required:"Only an organization owner or admin can approve or request changes.",
    revision_reason_required:"Provide an actionable revision request of at least 10 characters.",
    withdrawal_reason_required:"Provide a withdrawal reason of at least 10 characters.",
    version_conflict:"The release changed in another session. Refresh and review the newest revision.",
    scheduled_time_has_passed:"The scheduled date is in the past. Update the draft and request review again."
  };
  const found=Object.keys(codes).find(code=>message.includes(code));
  return found?codes[found]:message;
};
const when=(s:string)=>new Date(s).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});

export function EditorialWorkspace({organizationId,role,userId,onOpenDraft}:{
  organizationId:string;role:Role;userId:string;
  onOpenDraft:(releaseId:string)=>Promise<void>;
}){
  const supabase=useMemo(()=>createClient(),[]);
  const [releases,setReleases]=useState<Release[]>([]);
  const [setting,setSetting]=useState<ApprovalSetting|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [checks,setChecks]=useState<Check[]>([]);
  const [flags,setFlags]=useState<Flag[]>([]);
  const [history,setHistory]=useState<Audit[]>([]);
  const [note,setNote]=useState("");
  const [filter,setFilter]=useState<"pending"|"all">("pending");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const canReview=role==="owner"||role==="admin";
  const canWrite=canReview||role==="editor";
  const queue=releases.filter(r=>filter==="all"||r.status==="ready_for_review"||r.status==="changes_requested");
  const current=releases.find(r=>r.id===selected);
  const independent=current?.review_requires_independent??setting?.separation_of_duties??true;
  const cannotSelfApprove=!!current&&independent&&(current.created_by===userId||current.review_submitted_by===userId);

  const load=useCallback(async()=>{
    const [releaseRows,policy]=await Promise.all([
      supabase.from("press_releases")
        .select("id,organization_id,headline,summary,issuer,created_by,status,version,updated_at,review_submitted_by,review_requires_independent,review_policy_version,approved_version,approved_at,editorial_note,scheduled_for")
        .eq("organization_id",organizationId).is("archived_at",null).order("updated_at",{ascending:false}).limit(100),
      supabase.from("organization_approval_settings").select("*").eq("organization_id",organizationId).maybeSingle()
    ]);
    if(releaseRows.error)throw releaseRows.error;
    if(policy.error)throw policy.error;
    setReleases((releaseRows.data||[]) as Release[]);
    setSetting((policy.data||null) as ApprovalSetting|null);
  },[organizationId,supabase]);
  const loadEvidence=useCallback(async(id:string)=>{
    const [a,c,f]=await Promise.all([
      supabase.from("editorial_actions").select("id,version,from_status,to_status,note,actor_id,created_at")
        .eq("release_id",id).order("created_at",{ascending:false}).limit(50),
      supabase.rpc("release_readiness",{p_release_id:id}),
      supabase.rpc("release_integrity",{p_release_id:id})
    ]);
    if(a.error||c.error||f.error)throw a.error||c.error||f.error;
    setHistory((a.data||[]) as Audit[]);setChecks((c.data||[]) as Check[]);
    setFlags((f.data||[]) as Flag[]);
  },[supabase]);

  useEffect(()=>{
    let live=true;
    setLoading(true);setSelected(null);setHistory([]);setError("");setNotice("");
    load().catch(e=>{if(live)setError(errorLabel(e));}).finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  },[load]);
  async function selectRelease(id:string){
    setSelected(id);setNote("");setError("");setNotice("");
    try{await loadEvidence(id);}catch(e){setError(errorLabel(e));}
  }
  async function transition(item:Release,target:ReleaseStatus){
    if(busy||!canWrite)return;
    const rationale=note.trim();
    if(target==="changes_requested"&&rationale.length<10){
      setError("Give the author actionable feedback (at least 10 characters).");return;
    }
    if(target==="withdrawn"&&rationale.length<10){
      setError("Give a withdrawal reason (at least 10 characters).");return;
    }
    setBusy(true);setError("");setNotice("");
    try{
      const {data,error}=await supabase.from("press_releases")
        .update({status:target,version:item.version+1,editorial_note:rationale})
        .eq("id",item.id).eq("organization_id",organizationId)
        .eq("version",item.version).eq("status",item.status).select("id").maybeSingle();
      if(error)throw error;
      if(!data)throw new Error("version_conflict");
      await Promise.all([load(),loadEvidence(item.id)]);
      setNote("");
      setNotice(target==="approved"?"Editorial approval recorded. This does NOT distribute the release.":target==="ready_for_review"?
        "Review requested. No external publishing occurred.":target==="changes_requested"?
        "Changes requested and recorded in the audit history.":"Editorial status updated and audited.");
    }catch(e){setError(errorLabel(e));}
    finally{setBusy(false);}
  }
  async function changePolicy(next:boolean){
    if(role!=="owner"||busy)return;
    if(!next&&!window.confirm("Disable independent approval for future reviews? This permits the release author to approve their own submission. Existing review policies are not changed."))return;
    setBusy(true);setError("");setNotice("");
    try{
      const req=setting
        ?supabase.from("organization_approval_settings").update({separation_of_duties:next}).eq("organization_id",organizationId)
        :supabase.from("organization_approval_settings").insert({organization_id:organizationId,separation_of_duties:next});
      const {error}=await req;
      if(error)throw error;
      await load();setNotice("Approval policy saved. New reviews use the new policy version.");
    }catch(e){setError(errorLabel(e));}
    finally{setBusy(false);}
  }
  async function correction(item:Release){
    if(!canWrite||busy)return;
    if(!window.confirm("Create a new, private correction draft? The existing approval and history remain unchanged."))return;
    setBusy(true);setError("");setNotice("");
    try{
      const {data,error}=await supabase.rpc("create_release_correction",{p_release_id:item.id});
      if(error)throw error;
      await onOpenDraft(String(data));
      setNotice("Correction draft created. The original approved release is unchanged.");
    }catch(e){setError(errorLabel(e));}
    finally{setBusy(false);}
  }

  return <div className="studio-editorial-page">
    <div className="cloud-heading"><div><span className="cloud-tag">G2 · EDITORIAL WORKFLOW</span>
      <h1>Reviews and approvals</h1>
      <p>Internal editorial approval only. Publisher distribution, payments and external publication remain disabled.</p>
    </div><button className="cloud-button secondary" onClick={()=>{void load();if(selected)void loadEvidence(selected)}} type="button">
      <ArrowPathIcon width={16}/> Refresh</button></div>
    {error&&<div className="cloud-error" role="alert"><ExclamationTriangleIcon width={19}/>{error}</div>}
    {notice&&<div className="cloud-success" role="status"><CheckCircleIcon width={18}/>{notice}</div>}
    <section className="cloud-panel studio-policy">
      <div><ShieldCheckIcon width={23}/><div><h2>Organization approval policy</h2>
        <p>Independent approval protects against self-approval. Reviewers must be owners or admins.</p>
        <small>Policy version: {setting?.policy_version||1} · {setting?.separation_of_duties===false?"Self-approval permitted for future reviews":"Independent reviewer required by default"}</small>
      </div></div>
      {role==="owner"&&<label className="studio-policy-toggle"><input type="checkbox" checked={setting?.separation_of_duties!==false} disabled={busy}
        onChange={e=>void changePolicy(e.target.checked)}/> Require independent approval</label>}
    </section>
    <div className="studio-review-grid">
      <section className="cloud-panel studio-review-list">
        <div className="studio-review-head"><h2>Release queue</h2><div role="group" aria-label="Review queue filter">
          <button type="button" className={filter==="pending"?"selected":""} onClick={()=>setFilter("pending")}>Pending</button>
          <button type="button" className={filter==="all"?"selected":""} onClick={()=>setFilter("all")}>All</button>
        </div></div>
        {loading?<p>Loading editorial reviews…</p>:queue.length===0?<p>No releases match this filter.</p>:
        queue.map(r=><button type="button" className={"studio-review-item "+(selected===r.id?"active":"")} key={r.id}
          onClick={()=>void selectRelease(r.id)}>
          <strong>{r.headline||"Untitled release"}</strong>
          <span>{states[r.status]} · v{r.version} · {when(r.updated_at)}</span>
          {r.scheduled_for&&<small><ClockIcon width={13}/> Internal schedule: {when(r.scheduled_for)}</small>}
        </button>)}
      </section>
      <section className="cloud-panel studio-review-details">
        {!current?<div className="cloud-empty"><DocumentTextIcon width={28}/><p>Select a release to inspect its evidence, audit and available actions.</p></div>:<>
          <span className="cloud-tag">CURRENT VERSION · {current.version}</span>
          <h2>{current.headline||"Untitled release"}</h2>
          <p>{current.summary}</p>
          <div className="studio-review-meta"><strong>{states[current.status]}</strong>
            <span>Issuer: {current.issuer||"Not supplied"}</span>
            {current.approved_version&&<span>Approved snapshot: v{current.approved_version}</span>}
            {current.scheduled_for&&<span>Scheduled intent (not automatic publication): {when(current.scheduled_for)}</span>}
          </div>
          <div className="studio-check-columns">
            <div><h3>Readiness</h3>{checks.map(check=><div className="studio-check" key={check.check_id}>
              <span aria-hidden="true">{check.passed?"✓":"!"}</span><span>{check.criteria}</span></div>)}</div>
            <div><h3>Integrity signals</h3>{flags.map(f=><div className={"studio-check "+(f.flagged?"flagged":"")} key={f.check_id}>
              <span aria-hidden="true">{f.flagged?"!":"✓"}</span><span>{f.description}</span></div>)}
              <small>Heuristic screening is not factual verification. Flagged claims require human review.</small></div>
          </div>
          {(current.status==="ready_for_review"||current.status==="approved")&&canReview&&
            <label className="studio-review-note"><strong>Reviewer rationale</strong>
              <textarea rows={3} maxLength={3000} placeholder="Explain required changes, evidence review or withdrawal reason"
                value={note} onChange={e=>setNote(e.target.value)}/></label>}
          <div className="studio-review-actions">
            {(current.status==="draft"||current.status==="changes_requested")&&canWrite&&
              <><button className="cloud-button secondary" type="button" onClick={()=>void onOpenDraft(current.id)}>Edit draft</button>
              <button className="cloud-button" type="button" disabled={busy} onClick={()=>void transition(current,"ready_for_review")}>Request editorial review</button></>}
            {current.status==="ready_for_review"&&canReview&&<>
              <button className="cloud-button secondary" type="button" disabled={busy||note.trim().length<10}
                onClick={()=>void transition(current,"changes_requested")}>Request changes</button>
              <button className="cloud-button" type="button" disabled={busy||cannotSelfApprove}
                title={cannotSelfApprove?"An independent reviewer is required for this release":""}
                onClick={()=>void transition(current,"approved")}>Approve editorially</button>
              {cannotSelfApprove&&<p className="studio-review-warning">Another owner or admin must approve this release under its captured review policy.</p>}
            </>}
            {current.status==="approved"&&canReview&&<button className="cloud-button secondary" type="button" disabled={busy||note.trim().length<10}
              onClick={()=>void transition(current,"withdrawn")}>Withdraw approval</button>}
            {(current.status==="approved"||current.status==="withdrawn")&&canWrite&&
              <button className="cloud-button secondary" type="button" disabled={busy} onClick={()=>void correction(current)}>Create correction draft</button>}
          </div>
          <div className="studio-audit-history"><h3>Audit history</h3>
            {history.length===0?<p>No status transitions recorded yet.</p>:
            history.map(h=><div key={h.id}><strong>v{h.version} · {h.from_status} → {h.to_status}</strong>
              <small>{when(h.created_at)} · {h.actor_id===userId?"You":"Authorized team member"}</small>
              {h.note&&<p>{h.note}</p>}</div>)}
          </div>
        </>}
      </section>
    </div>
  </div>;
}
