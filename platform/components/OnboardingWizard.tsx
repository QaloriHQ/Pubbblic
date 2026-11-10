"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRightIcon, CheckCircleIcon, EnvelopeIcon, LockClosedIcon,
  BuildingOfficeIcon, UserGroupIcon, DocumentTextIcon
} from "@heroicons/react/24/outline";
import { createClient } from "@/lib/supabase/browser";

type Profile={password_set_at:string|null;invitations_reviewed_at:string|null};
type Organization={id:string;name:string;role:"owner"|"admin"|"editor"|"viewer"};
type Invitation={invitation_id:string;organization_name:string;invited_role:string;expires_at:string};
const stages=[
  {name:"Secure account",detail:"Set a password",icon:LockClosedIcon},
  {name:"Workspace",detail:"Create or join",icon:BuildingOfficeIcon},
  {name:"Team",detail:"Review invitations",icon:UserGroupIcon},
  {name:"First release",detail:"Start authoring",icon:DocumentTextIcon},
];
function errorMessage(err:unknown){return err instanceof Error?err.message:"Unable to complete that request.";}
export function OnboardingWizard({
  userId,userEmail,preferredInviteId="",preferredOrgId=""
}:{
  userId:string;userEmail:string;preferredInviteId?:string;preferredOrgId?:string
}){
  const router=useRouter();
  const supabase=useMemo(()=>createClient(),[]);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [orgs,setOrgs]=useState<Organization[]>([]);
  const [invitations,setInvitations]=useState<Invitation[]>([]);
  const [activeOrgId,setActiveOrgId]=useState(preferredOrgId);
  const [hasRelease,setHasRelease]=useState(false);
  const [name,setName]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [revealPassword,setRevealPassword]=useState(false);
  const [inviteEmail,setInviteEmail]=useState("");
  const [inviteRole,setInviteRole]=useState<"admin"|"editor"|"viewer">("editor");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const refresh=useCallback(async(preferOrgId?:string)=>{
    const [profileResult,memberResult,invitationResult]=await Promise.all([
      supabase.from("user_onboarding").select("password_set_at,invitations_reviewed_at").eq("user_id",userId).single(),
      supabase.from("organization_memberships").select("organization_id,role").eq("user_id",userId),
      supabase.rpc("my_organization_invitations")
    ]);
    if(profileResult.error)throw profileResult.error;
    if(memberResult.error)throw memberResult.error;
    if(invitationResult.error)throw invitationResult.error;
    const memberRows=memberResult.data||[];
    const ids=memberRows.map(m=>m.organization_id);
    let organizations:{id:string;name:string}[]=[];
    if(ids.length){
      const result=await supabase.from("organizations").select("id,name").in("id",ids);
      if(result.error)throw result.error;
      organizations=result.data||[];
    }
    const next=memberRows.flatMap(member=>{
      const org=organizations.find(o=>o.id===member.organization_id);
      return org?[{id:org.id,name:org.name,role:member.role as Organization["role"]}]:[];
    });
    const selected=next.find(o=>o.id===preferOrgId)||next.find(o=>o.id===activeOrgId)||
      next.find(o=>o.id===preferredOrgId)||next[0];
    let releaseExists=false;
    if(selected){
      const result=await supabase.from("press_releases")
        .select("id").eq("organization_id",selected.id).is("archived_at",null).limit(1);
      if(result.error)throw result.error;
      releaseExists=(result.data||[]).length>0;
    }
    setProfile(profileResult.data);
    setOrgs(next);
    setInvitations((invitationResult.data||[]) as Invitation[]);
    setActiveOrgId(selected?.id||"");
    setHasRelease(releaseExists);
  },[supabase,userId,activeOrgId,preferredOrgId]);

  useEffect(()=>{
    let alive=true;
    setLoading(true);
    refresh().catch(err=>{if(alive)setError(errorMessage(err));})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[refresh]);

  const org=orgs.find(x=>x.id===activeOrgId);
  const canInvite=org?.role==="owner"||org?.role==="admin";
  const canWrite=!!org&&org.role!=="viewer";
  const step=!profile?.password_set_at?1:orgs.length===0?2:!profile?.invitations_reviewed_at?3:4;
  async function apply(run:()=>Promise<void>){
    setBusy(true);setError("");setNotice("");
    try{await run();}catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  }
  async function setAccountPassword(e:React.FormEvent){
    e.preventDefault();
    if(password.length<12||password.length>128||!/[a-z]/.test(password)||
       !/[A-Z]/.test(password)||!/[0-9]/.test(password)){
      setError("Use 12–128 characters, with uppercase, lowercase and a number.");return;
    }
    if(password!==confirmPassword){setError("Passwords do not match.");return;}
    await apply(async()=>{
      const {data,error:fnError}=await supabase.functions.invoke("complete-onboarding-password",{
        body:{password}
      });
      if(fnError||!data?.password_set){
        let reason=data?.message||data?.error||"Password could not be saved.";
        if(fnError&&"context" in fnError&&fnError.context instanceof Response){
          const body=await fnError.context.clone().json().catch(()=>null);
          reason=body?.message||body?.error||reason;
        }
        throw new Error(reason);
      }
      setPassword("");setConfirmPassword("");
      await refresh();
      setNotice("Password saved securely. Continue with your organization workspace.");
    });
  }
  async function createOrganization(e:React.FormEvent){
    e.preventDefault();if(!name.trim())return;
    await apply(async()=>{
      const {data,error:e}=await supabase.rpc("create_organization",{p_name:name.trim()});
      if(e)throw e;
      setActiveOrgId(String(data));
      await refresh(String(data));
      setNotice("Organization created. You are its Owner.");
    });
  }
  async function acceptInvitation(id:string){
    await apply(async()=>{
      const {data,error:e}=await supabase.rpc("accept_organization_invitation",{p_invitation_id:id});
      if(e)throw e;
      setActiveOrgId(String(data));
      await refresh(String(data));
      setNotice("Invitation accepted. Your organization access is active.");
    });
  }
  async function sendInvite(e:React.FormEvent){
    e.preventDefault();if(!org||!canInvite)return;
    await apply(async()=>{
      const {data,error:e}=await supabase.rpc("invite_organization_member",{
        p_organization_id:org.id,p_email:inviteEmail.trim().toLowerCase(),p_role:inviteRole
      });
      if(e)throw e;
      setInviteEmail("");
      const {error:sendError}=await supabase.functions.invoke("notify-organization-invitation",{
        body:{invitation_id:String(data)}
      });
      setNotice(sendError
        ?"Invitation saved, but the email request failed. You can retry from Team & Invitations in your workspace."
        :"Invitation saved. Supabase accepted the email request; recipient must explicitly accept.");
    });
  }
  async function completeTeamStep(){
    await apply(async()=>{
      const {data,error:e}=await supabase.functions.invoke("complete-onboarding-team",{body:{}});
      if(e||!data?.invitations_reviewed)throw new Error("Could not finish team setup. Try again or contact support.");
      await refresh();
      setNotice("Team step complete. Your release workspace is ready.");
    });
  }
  async function logout(){
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  const focusedInvites=[...invitations].sort((a,b)=>Number(b.invitation_id===preferredInviteId)-Number(a.invitation_id===preferredInviteId));
  return <div className="pub-onboarding">
    <header className="pub-onboarding-header">
      <Link href="https://pubbblic.com" className="pub-onboarding-logo">pubbblic<span>.</span><small> STUDIO</small></Link>
      <div><span>{userEmail}</span><button type="button" onClick={logout}>Sign out</button></div>
    </header>
    <main className="pub-onboarding-main">
      <span className="cloud-tag">PUBBBLIC STUDIO · GETTING STARTED</span>
      <h1>Set up your workspace</h1>
      <p className="pub-onboarding-lead">Four straightforward steps to prepare your account, collaborate with your team and create your first announcement.</p>
      <nav className="pub-onboarding-steps" aria-label="Onboarding steps">
        {stages.map((s,i)=>{
          const Icon=s.icon;
          return <div key={s.name} className={"pub-onboarding-step "+(step===i+1?"current":step>i+1?"done":"")} aria-current={step===i+1?"step":undefined}>
            <div className="pub-onboarding-step-icon">{step>i+1?<CheckCircleIcon width={21}/>:<Icon width={21}/>}</div>
            <span><strong>{i+1}. {s.name}</strong><small>{s.detail}</small></span>
          </div>;
        })}
      </nav>
      {error&&<div className="auth-error" role="alert">{error}</div>}
      {notice&&<div className="auth-notice" role="status">{notice}</div>}
      {loading||!profile?<div className="pub-onboarding-panel"><p>Loading your secure setup…</p></div>:
       step===1?<section className="pub-onboarding-panel">
        <span className="cloud-tag">STEP 01 · ACCOUNT SECURITY</span>
        <h2>Create your password</h2>
        <p>Verify your email first, then set a password to protect your Pubbblic account. Your password is stored only by Supabase Auth.</p>
        <form onSubmit={setAccountPassword}>
          <label htmlFor="setup-password">Password</label>
          <input id="setup-password" type={revealPassword?"text":"password"} required autoComplete="new-password"
            minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="At least 12 characters"/>
          <label htmlFor="setup-confirm">Confirm password</label>
          <input id="setup-confirm" type={revealPassword?"text":"password"} required autoComplete="new-password"
            minLength={12} maxLength={128} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"/>
          <label className="pub-onboarding-check"><input type="checkbox" checked={revealPassword} onChange={e=>setRevealPassword(e.target.checked)}/> Show passwords</label>
          <small>Use at least 12 characters, including uppercase, lowercase and a number. Never share your password.</small>
          <button className="cloud-button pub-onboarding-action" type="submit" disabled={busy}>{busy?"Saving securely…":"Set password & continue"}<ArrowRightIcon width={17}/></button>
        </form>
       </section>:
       step===2?<section className="pub-onboarding-panel">
        <span className="cloud-tag">STEP 02 · WORKSPACE</span>
        <h2>Create or join an organization</h2>
        <p>Accept a pending organization invitation, or create a new workspace for your business. You don't need a duplicate organization if you've already been invited.</p>
        {focusedInvites.length>0&&<div className="pub-onboarding-invites">
          <h3>Invitations waiting for you</h3>
          {focusedInvites.map(inv=><div key={inv.invitation_id} className="pub-onboarding-invite">
            <div><strong>{inv.organization_name}</strong><small>{inv.invited_role} · expires {new Date(inv.expires_at).toLocaleDateString()}</small></div>
            <button type="button" className="cloud-button" disabled={busy} onClick={()=>acceptInvitation(inv.invitation_id)}>Accept & join</button>
          </div>)}
        </div>}
        <form onSubmit={createOrganization}>
          <label htmlFor="setup-org-name">Organization name</label>
          <input id="setup-org-name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Your company or agency"/>
          <button type="submit" className="cloud-button pub-onboarding-action" disabled={busy}>{busy?"Creating…":"Create organization"}<ArrowRightIcon width={17}/></button>
        </form>
       </section>:
       step===3?<section className="pub-onboarding-panel">
        <span className="cloud-tag">STEP 03 · YOUR TEAM</span>
        <h2>Review invitations and collaborators</h2>
        <p>Workspace: <strong>{org?.name}</strong> · Your role: <strong>{org?.role}</strong></p>
        {focusedInvites.length>0&&<div className="pub-onboarding-invites">
          <h3>Other invitations for your account</h3>
          {focusedInvites.map(inv=><div key={inv.invitation_id} className="pub-onboarding-invite">
            <div><strong>{inv.organization_name}</strong><small>{inv.invited_role}</small></div>
            <button className="cloud-button secondary" type="button" disabled={busy} onClick={()=>acceptInvitation(inv.invitation_id)}>Accept invitation</button>
          </div>)}
        </div>}
        {canInvite?<form onSubmit={sendInvite}>
          <h3>Invite your first teammate (optional)</h3>
          <label htmlFor="setup-invite-email">Teammate email address</label>
          <input id="setup-invite-email" required type="email" maxLength={254} value={inviteEmail}
            onChange={e=>setInviteEmail(e.target.value)} placeholder="teammate@company.com"/>
          <label htmlFor="setup-invite-role">Permission</label>
          <select id="setup-invite-role" value={inviteRole} onChange={e=>setInviteRole(e.target.value as typeof inviteRole)}>
            <option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option>
          </select>
          <button className="cloud-button secondary pub-onboarding-action" disabled={busy} type="submit">Send invitation</button>
        </form>:<p className="pub-onboarding-note">As a {org?.role}, you can collaborate in the workspace. Team invitations are managed by organization owners and admins.</p>}
        <button type="button" className="cloud-button pub-onboarding-action" disabled={busy} onClick={completeTeamStep}>Continue to first release <ArrowRightIcon width={17}/></button>
       </section>:
       <section className="pub-onboarding-panel">
        <span className="cloud-tag">STEP 04 · FIRST PRESS RELEASE</span>
        <h2>{hasRelease?"Your workspace is ready":"Create your first press release"}</h2>
        <p>{org?.role==="viewer"
          ?"Your role is Viewer. You can review the organization's releases; an Editor, Admin or Owner creates announcements."
          :hasRelease
          ?"An announcement is already saved in this workspace. You're ready to continue."
          :"Start a private draft. Add a headline, summary, body and media contact; no external distribution occurs during onboarding."}</p>
        <Link className="cloud-button pub-onboarding-action" href={
          "/dashboard?organization="+encodeURIComponent(org?.id||"")+
          (canWrite&&!hasRelease?"&start=editor":"")
        }>{canWrite&&!hasRelease?"Open release editor":"Open workspace"}<ArrowRightIcon width={17}/></Link>
       </section>}
    </main>
    <footer className="pub-onboarding-footer">Secure onboarding · No external publishing · Pubbblic is a <a href="https://mahtco.com">Mahtco</a> company</footer>
  </div>;
}
