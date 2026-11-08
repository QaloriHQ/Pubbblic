"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
 ArrowDownTrayIcon, ArrowLeftIcon, ArrowRightIcon, BuildingOfficeIcon, CheckCircleIcon,
 ChevronDownIcon, ClockIcon, CloudArrowUpIcon, DocumentTextIcon, ExclamationCircleIcon,
 GlobeAltIcon, LockClosedIcon, PlusIcon, ShieldCheckIcon, UsersIcon, XMarkIcon
} from "@heroicons/react/24/outline";
import { createClient } from "@/lib/supabase/browser";
import { wordCount } from "@/lib/release";

type Role = "owner" | "admin" | "editor" | "viewer";
type Org = { id:string; name:string; role:Role };
type Invitation = {invitation_id:string;organization_name:string;invited_role:string;expires_at:string};
type Membership = {user_id:string;role:Role;created_at:string};
type ReleaseForm = {
 headline:string; summary:string; issuer:string; dateline:string;
 category:string; body:string; quote_text:string; quote_attribution:string;
 boilerplate:string; contact_name:string; contact_email:string;
};
type Release = ReleaseForm & {
 id:string; organization_id:string; created_by:string;
 version:number; status:string; updated_at:string; created_at:string; archived_at:string|null;
};
type Asset = {id:string;object_path:string;file_name:string;mime_type:string;byte_size:number};
type Tab = "home"|"releases"|"editor"|"team"|"settings";
const blank:ReleaseForm={headline:"",summary:"",issuer:"",dateline:"",category:"Company news",body:"",quote_text:"",quote_attribution:"",boilerplate:"",contact_name:"",contact_email:""};
const categories=["Company news","Product launch","Partnership","Milestone","Event","Other"];
function fmtDate(raw:string){return new Date(raw).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function short(error:unknown){return error instanceof Error?error.message:"Request failed. Try again.";}
function Logo(){return <div className="cloud-logo"><b>pubbblic<span>.</span></b><small>STUDIO</small></div>}
function Field({title,required=false,children,hint}:{title:string;required?:boolean;children:React.ReactNode;hint?:string}){
 return <label className="cloud-field"><span>{title}{required&&<b> *</b>}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
export function CloudWorkspace({userId,userEmail}:{userId:string;userEmail:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const router=useRouter();
 const [orgs,setOrgs]=useState<Org[]>([]);
 const [orgId,setOrgId]=useState("");
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [releases,setReleases]=useState<Release[]>([]);
 const [members,setMembers]=useState<Membership[]>([]);
 const [assets,setAssets]=useState<Asset[]>([]);
 const [tab,setTab]=useState<Tab>("home");
 const [form,setForm]=useState<ReleaseForm>({...blank});
 const [editingId,setEditingId]=useState<string|null>(null);
 const [editingVersion,setEditingVersion]=useState(0);
 const [orgName,setOrgName]=useState("");
 const [inviteEmail,setInviteEmail]=useState("");
 const [inviteRole,setInviteRole]=useState<"admin"|"editor"|"viewer">("editor");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [uploading,setUploading]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);

 const org=orgs.find(x=>x.id===orgId);
 const canWrite=org?.role==="owner"||org?.role==="admin"||org?.role==="editor";
 const canInvite=org?.role==="owner"||org?.role==="admin";
 const currentRelease=releases.find(x=>x.id===editingId);
 const checks=[
  {label:"Clear headline",valid:form.headline.trim().length>=15&&form.headline.length<=140},
  {label:"Informative summary",valid:form.summary.trim().length>=35&&form.summary.length<=320},
  {label:"Issuer and dateline",valid:form.issuer.trim().length>=2&&form.dateline.trim().length>=8},
  {label:"Release body",valid:wordCount(form.body)>=60},
  {label:"Media contact",valid:form.contact_name.trim().length>1&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)},
  {label:"Attributed quotes",valid:!form.quote_text.trim()||form.quote_attribution.trim().length>2}
 ];
 const checksDone=checks.filter(c=>c.valid).length;

 const loadOrgs=useCallback(async()=>{
   const {data:membershipRows,error:membershipError}=await supabase.from("organization_memberships").select("organization_id,role").eq("user_id",userId);
   if(membershipError)throw membershipError;
   const ids=(membershipRows||[]).map(m=>m.organization_id);
   let organizations:{id:string;name:string}[]=[];
   if(ids.length){
     const {data,error:e}=await supabase.from("organizations").select("id,name").in("id",ids);
     if(e)throw e;
     organizations=data||[];
   }
   const next:Org[]=ids.flatMap(id=>{
     const o=organizations.find(v=>v.id===id);
     const m=membershipRows?.find(row=>row.organization_id===id);
     return o&&m?[{...o,role:m.role as Role}]:[];
   });
   setOrgs(next);
   setOrgId(old=>next.some(o=>o.id===old)?old:next[0]?.id||"");
   const {data:inv,error:invErr}=await supabase.rpc("my_organization_invitations");
   if(!invErr)setInvitations((inv||[]) as Invitation[]);
 },[supabase,userId]);
 const loadReleases=useCallback(async(id:string)=>{
   const {data,error:e}=await supabase.from("press_releases").select("*").eq("organization_id",id).is("archived_at",null).order("updated_at",{ascending:false}).limit(100);
   if(e)throw e;
   setReleases((data||[]) as Release[]);
 },[supabase]);
 const loadMembers=useCallback(async(id:string)=>{
   const {data,error:e}=await supabase.from("organization_memberships").select("user_id,role,created_at").eq("organization_id",id);
   if(e)throw e;
   setMembers((data||[]) as Membership[]);
 },[supabase]);
 const loadAssets=useCallback(async(id:string)=>{
   const {data,error:e}=await supabase.from("press_release_media").select("id,object_path,file_name,mime_type,byte_size").eq("release_id",id).order("created_at",{ascending:false});
   if(e)throw e;
   setAssets((data||[]) as Asset[]);
 },[supabase]);
 useEffect(()=>{
   let active=true;
   (async()=>{
     try{await loadOrgs();if(active)setError("");}
     catch(err){if(active)setError("Workspace data unavailable: "+short(err));}
     finally{if(active)setLoading(false);}
   })();
   return()=>{active=false};
 },[loadOrgs]);
 useEffect(()=>{
   if(!orgId){setReleases([]);setMembers([]);return;}
   loadReleases(orgId).catch(e=>setError("Could not load releases: "+short(e)));
   loadMembers(orgId).catch(e=>setError("Could not load team members: "+short(e)));
 },[orgId,loadReleases,loadMembers]);
 useEffect(()=>{
   if(editingId)loadAssets(editingId).catch(e=>setError("Could not load attachments: "+short(e)));
   else setAssets([]);
 },[editingId,loadAssets]);

 function switchTab(next:Tab){setTab(next);setNotice("");setError("");setMobileOpen(false);window.scrollTo({top:0,behavior:"smooth"});}
 function newRelease(){setForm({...blank});setEditingId(null);setEditingVersion(0);switchTab("editor");}
 function editRelease(release:Release){
   const fields=Object.keys(blank) as (keyof ReleaseForm)[];
   const value={...blank};
   for(const key of fields)value[key]=release[key];
   setForm(value);setEditingId(release.id);setEditingVersion(release.version);switchTab("editor");
 }
 function field<K extends keyof ReleaseForm>(key:K,value:ReleaseForm[K]){setForm(old=>({...old,[key]:value}));setNotice("");}
 async function createOrg(e:React.FormEvent){
   e.preventDefault();setBusy(true);setError("");setNotice("");
   try{
     const {data,error:e}=await supabase.rpc("create_organization",{p_name:orgName.trim()});
     if(e)throw e;
     await loadOrgs();setOrgId(String(data));setOrgName("");
     setNotice("Organization workspace created. You are the owner.");
   }catch(e){setError(short(e));}
   finally{setBusy(false);}
 }
 async function acceptInvitation(id:string){
   setBusy(true);setError("");setNotice("");
   try{
     const {data,error:e}=await supabase.rpc("accept_organization_invitation",{p_invitation_id:id});
     if(e)throw e;
     await loadOrgs();setOrgId(String(data));setNotice("Invitation accepted. You can now access that organization.");
   }catch(e){setError(short(e));}
   finally{setBusy(false);}
 }
 async function inviteMember(e:React.FormEvent){
   e.preventDefault();if(!orgId||!canInvite)return;
   setBusy(true);setError("");setNotice("");
   try{
     const {error:e}=await supabase.rpc("invite_organization_member",{p_organization_id:orgId,p_email:inviteEmail.trim().toLowerCase(),p_role:inviteRole});
     if(e)throw e;
     setNotice("Invitation recorded. Ask this person to sign in using the invited email; the invitation will appear in their workspace.");
     setInviteEmail("");
   }catch(e){setError(short(e));}
   finally{setBusy(false);}
 }
 async function saveRelease(e?:React.FormEvent){
   e?.preventDefault();if(!orgId||!canWrite)return;
   setBusy(true);setError("");setNotice("");
   try{
     let saved:Release;
     if(editingId){
       const {data,error:e}=await supabase.from("press_releases").update({...form,version:editingVersion+1})
         .eq("id",editingId).eq("organization_id",orgId).eq("version",editingVersion)
         .eq("status","draft").select("*").maybeSingle();
       if(e)throw e;
       if(!data)throw new Error("This release changed in another session. Reopen it to review the latest version before saving.");
       saved=data as Release;
     }else{
       const {data,error:e}=await supabase.from("press_releases").insert({
         ...form,organization_id:orgId,created_by:userId,status:"draft",version:1
       }).select("*").single();
       if(e)throw e;
       saved=data as Release;
     }
     setEditingId(saved.id);setEditingVersion(saved.version);
     setNotice("Saved securely to your organization's workspace. Revision "+saved.version+" recorded.");
     await loadReleases(orgId);
   }catch(e){setError(short(e));}
   finally{setBusy(false);}
 }
 async function archiveRelease(release:Release){
   if(!canWrite||!window.confirm("Archive this draft? It will be hidden from the active list."))return;
   setBusy(true);setError("");setNotice("");
   try{
     const {data,error:e}=await supabase.from("press_releases").update({
       version:release.version+1,archived_at:new Date().toISOString()
     }).eq("id",release.id).eq("organization_id",orgId).eq("status","draft").eq("version",release.version).select("id").maybeSingle();
     if(e)throw e;
     if(!data)throw new Error("The release changed. Refresh the list and try again.");
     await loadReleases(orgId);setNotice("Draft archived.");
   }catch(e){setError(short(e));}
   finally{setBusy(false);}
 }
 async function uploadAsset(file:File){
   if(!editingId||!orgId||!canWrite)return;
   const allowed:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"};
   if(!allowed[file.type]||file.size>10485760||file.size===0){setError("Only JPEG, PNG, WEBP or PDF files up to 10 MB are permitted.");return;}
   const path=orgId+"/"+editingId+"/"+crypto.randomUUID()+"."+allowed[file.type];
   setUploading(true);setError("");setNotice("");
   try{
     const {error:upError}=await supabase.storage.from("release-assets").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"private"});
     if(upError)throw upError;
     const {error:e}=await supabase.from("press_release_media").insert({
       organization_id:orgId,release_id:editingId,object_path:path,
       file_name:file.name.slice(0,255),mime_type:file.type,byte_size:file.size,uploaded_by:userId
     });
     if(e)throw new Error("The file was uploaded but its metadata could not be saved. Contact support before retrying: "+e.message);
     await loadAssets(editingId);setNotice("Attachment uploaded to private release storage.");
   }catch(e){setError(short(e));}
   finally{setUploading(false);}
 }
 async function openAsset(asset:Asset){
   const {data,error:e}=await supabase.storage.from("release-assets").createSignedUrl(asset.object_path,60);
   if(e||!data){setError(e?.message||"Could not authorize this file.");return;}
   window.open(data.signedUrl,"_blank","noopener,noreferrer");
 }
 async function signOut(){
   setBusy(true);
   const {error:e}=await supabase.auth.signOut();
   if(e){setError(e.message);setBusy(false);return;}
   router.replace("/login");router.refresh();
 }
 const orgSwitcher=<select aria-label="Selected organization" value={orgId} onChange={e=>{setOrgId(e.target.value);switchTab("home");}}>
   {orgs.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}
 </select>;
 return <div className="cloud-app">
   <aside className={"cloud-sidebar "+(mobileOpen?"opened":"")}>
     <div className="cloud-sidebar-head"><Logo/><button className="cloud-close" onClick={()=>setMobileOpen(false)} aria-label="Close menu"><XMarkIcon width={22}/></button></div>
     <div className="cloud-org-picker"><div className="cloud-small-label">CURRENT ORGANIZATION</div>{orgs.length?orgSwitcher:<span>Set up a workspace</span>}</div>
     <nav className="cloud-nav" aria-label="Workspace navigation">
       {([{key:"home",label:"Overview",icon:BuildingOfficeIcon},{key:"releases",label:"Press releases",icon:DocumentTextIcon},{key:"editor",label:"Release editor",icon:PlusIcon},{key:"team",label:"Team & invitations",icon:UsersIcon},{key:"settings",label:"Account settings",icon:ShieldCheckIcon}] as const).map(item=>
         <button key={item.key} type="button" className={tab===item.key?"active":""}
           onClick={()=>{if(item.key==="editor")newRelease();else switchTab(item.key);}}><item.icon width={19}/>{item.label}</button>
       )}
     </nav>
     <div className="cloud-side-bottom"><div className="cloud-role"><LockClosedIcon width={18}/><div><strong>Secure workspace</strong><small>{org?.role||"No organization"} · Publishing disabled</small></div></div><Link href="/preview">Try local demo ↗</Link><a href="https://pubbblic.com">Marketing website ↗</a></div>
   </aside>
   {mobileOpen&&<button className="cloud-backdrop" aria-label="Close menu" onClick={()=>setMobileOpen(false)}/>}
   <div className="cloud-main">
     <header className="cloud-top"><button className="cloud-hamburger" aria-label="Open menu" onClick={()=>setMobileOpen(true)}>☰</button><span>{org?.name||"Pubbblic"} <ChevronDownIcon width={14}/></span><div><small>{userEmail}</small><button onClick={signOut} disabled={busy}>Sign out</button></div></header>
     <div className="cloud-content">
       <div className="cloud-safety"><ShieldCheckIcon width={20}/><span>Private organization workspace. Releases are not published externally. DeepSeek, Zyte and payments remain disabled.</span></div>
       {error&&<div className="cloud-error" role="alert"><ExclamationCircleIcon width={18}/>{error}<button onClick={()=>setError("")}>Dismiss</button></div>}
       {notice&&<div className="cloud-success" role="status"><CheckCircleIcon width={18}/>{notice}<button onClick={()=>setNotice("")}>×</button></div>}
       {loading?<div className="cloud-empty">Loading your workspaces…</div>:<>
         {!orgs.length&&<section className="cloud-setup"><span className="cloud-tag">GET STARTED</span><h1>Create your organization workspace</h1><p>Pubbblic keeps your team&apos;s press releases separate from other organizations. Create a workspace to store drafts securely, invite colleagues and preserve revisions.</p>
           <form onSubmit={createOrg}><Field title="Organization name" required><input value={orgName} maxLength={120} minLength={2} onChange={e=>setOrgName(e.target.value)} placeholder="Your company or agency" required/></Field><button className="cloud-button" type="submit" disabled={busy}>{busy?"Creating…":"Create organization"} <ArrowRightIcon width={17}/></button></form>
           {invitations.length>0&&<div className="cloud-invite-list"><h3>Invitations for your email</h3>{invitations.map(i=><div key={i.invitation_id}><div><strong>{i.organization_name}</strong><span>{i.invited_role} · expires {fmtDate(i.expires_at)}</span></div><button onClick={()=>acceptInvitation(i.invitation_id)} disabled={busy}>Accept</button></div>)}</div>}
         </section>}
         {orgs.length>0&&<>
           {tab==="home"&&<><div className="cloud-heading"><div><span className="cloud-tag">ORGANIZATION WORKSPACE</span><h1>Welcome to {org?.name}.</h1><p>Make thoughtful announcements, collaborate securely and prepare for distribution.</p></div>{canWrite&&<button className="cloud-button" onClick={newRelease}><PlusIcon width={18}/> New release</button>}</div>
             <div className="cloud-stats"><div><small>Active drafts</small><strong>{releases.length}</strong><span>Stored in your organization</span></div><div><small>Team members</small><strong>{members.length}</strong><span>Role-based access</span></div><div><small>Published releases</small><strong>0</strong><span>Distribution not enabled</span></div></div>
             <div className="cloud-two-col"><section className="cloud-panel"><div className="cloud-panel-head"><div><span className="cloud-tag">RECENT DRAFTS</span><h2>Press releases</h2></div><button onClick={()=>switchTab("releases")}>View all <ArrowRightIcon width={16}/></button></div>
               {releases.length?releases.slice(0,5).map(r=><button className="cloud-release-item" key={r.id} onClick={()=>editRelease(r)}><DocumentTextIcon width={20}/><div><strong>{r.headline||"Untitled draft"}</strong><small>Version {r.version} · Updated {fmtDate(r.updated_at)}</small></div><span>Draft</span></button>):<div className="cloud-empty"><DocumentTextIcon width={27}/><p>No drafts in this organization yet.</p>{canWrite&&<button className="cloud-button secondary" onClick={newRelease}>Create a release</button>}</div>}
             </section><section className="cloud-panel cloud-guide"><span className="cloud-tag">YOUR FOUNDATION</span><h2>From draft to distribution.</h2><p>Your release workspace includes secure storage and automatic revision history. Later builds will add approval routing, validated DeepSeek rewrites and authorized publisher submission.</p><div><CheckCircleIcon width={17}/> Verified user identity</div><div><CheckCircleIcon width={17}/> Tenant-isolated release records</div><div><ClockIcon width={17}/> AI & distribution pending validation</div></section></div>
             {invitations.length>0&&<section className="cloud-panel cloud-invite-banner"><h2>Organization invitations</h2>{invitations.map(i=><div key={i.invitation_id}><strong>{i.organization_name}</strong> · {i.invited_role}<button onClick={()=>acceptInvitation(i.invitation_id)} disabled={busy}>Accept invitation</button></div>)}</section>}
           </>}
           {tab==="releases"&&<><div className="cloud-heading"><div><span className="cloud-tag">RELEASE LIBRARY</span><h1>Press releases</h1><p>Draft content is stored in Supabase with organization-based access controls and revision history.</p></div>{canWrite&&<button className="cloud-button" onClick={newRelease}><PlusIcon width={18}/> New release</button>}</div>
             <section className="cloud-panel cloud-list"><div className="cloud-panel-head"><h2>{releases.length} active draft{releases.length===1?"":"s"}</h2><span>Organization: {org?.name}</span></div>
               {!releases.length?<div className="cloud-empty"><DocumentTextIcon width={28}/><p>No releases yet.</p></div>:releases.map(r=><div className="cloud-release-item" key={r.id}><DocumentTextIcon width={22}/><div><strong>{r.headline||"Untitled draft"}</strong><small>{r.category} · Version {r.version} · {fmtDate(r.updated_at)}</small></div><button onClick={()=>editRelease(r)}>Open</button>{canWrite&&<button className="cloud-archive" onClick={()=>archiveRelease(r)} disabled={busy}>Archive</button>}</div>)}
             </section></>}
           {tab==="editor"&&<><div className="cloud-heading cloud-editor-heading"><div><button className="cloud-back" onClick={()=>switchTab("releases")}><ArrowLeftIcon width={16}/> Back to releases</button><span className="cloud-tag">RELEASE EDITOR</span><h1>{editingId?"Edit press release":"Create a press release"}</h1><p>Every save creates an immutable revision in your organization&apos;s workspace.</p></div>{canWrite&&<button className="cloud-button" onClick={()=>saveRelease()} disabled={busy}>{busy?"Saving…":"Save release"} <ArrowRightIcon width={17}/></button>}</div>
             {!canWrite?<div className="cloud-panel cloud-empty"><LockClosedIcon width={27}/><p>This organization role is read-only.</p></div>:<div className="cloud-editor-grid"><form className="cloud-panel cloud-editor" onSubmit={saveRelease}>
               <h2>Announcement details</h2><Field title="Headline" required hint={form.headline.length+"/140 characters"}><input maxLength={140} value={form.headline} onChange={e=>field("headline",e.target.value)} placeholder="Company announces a verified new milestone"/></Field>
               <Field title="Summary" required hint={form.summary.length+"/320 characters"}><textarea maxLength={320} rows={3} value={form.summary} onChange={e=>field("summary",e.target.value)} placeholder="Summarize what happened and who it affects."/></Field>
               <div className="cloud-fields-two"><Field title="Organization / issuer"><input value={form.issuer} maxLength={160} onChange={e=>field("issuer",e.target.value)} placeholder="Company name"/></Field><Field title="Announcement type"><select value={form.category} onChange={e=>field("category",e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field></div>
               <Field title="Dateline"><input value={form.dateline} maxLength={180} onChange={e=>field("dateline",e.target.value)} placeholder="CITY, State — Month Day, Year"/></Field>
               <h2>Release body</h2><Field title="Press release body" required hint={wordCount(form.body)+" words (60 recommended for draft readiness)"}><textarea rows={12} maxLength={100000} value={form.body} onChange={e=>field("body",e.target.value)} placeholder="Lead with the announcement, add evidence and supporting context..."/></Field>
               <div className="cloud-fields-two"><Field title="Approved quote (optional)"><textarea rows={3} maxLength={5000} value={form.quote_text} onChange={e=>field("quote_text",e.target.value)}/></Field><Field title="Quote attribution"><input maxLength={500} value={form.quote_attribution} onChange={e=>field("quote_attribution",e.target.value)} placeholder="Name and title"/></Field></div>
               <Field title="Company boilerplate"><textarea rows={3} maxLength={10000} value={form.boilerplate} onChange={e=>field("boilerplate",e.target.value)}/></Field>
               <h2>Media contact</h2><div className="cloud-fields-two"><Field title="Contact name"><input value={form.contact_name} maxLength={160} onChange={e=>field("contact_name",e.target.value)}/></Field><Field title="Contact email"><input type="email" value={form.contact_email} maxLength={254} onChange={e=>field("contact_email",e.target.value)}/></Field></div>
               <button className="cloud-button" type="submit" disabled={busy}>{busy?"Saving…":editingId?"Save new revision":"Create draft"} <ArrowRightIcon width={17}/></button>
             </form><aside className="cloud-editor-side"><section className="cloud-panel cloud-checks"><span className="cloud-tag">EDITORIAL COMPLETENESS</span><h2>{checksDone}/{checks.length} checks</h2><div className="cloud-progress"><span style={{width:(checksDone/checks.length*100)+"%"}}/></div>{checks.map(c=><div key={c.label}><span className={c.valid?"ok":"pending"}>{c.valid?<CheckCircleIcon width={18}/>:<ExclamationCircleIcon width={18}/>}</span>{c.label}</div>)}<small>These are drafting checks, not publisher acceptance or verified factual approval.</small></section>
             <section className="cloud-panel cloud-release-preview"><span className="cloud-tag">LIVE DRAFT PREVIEW</span><h2>{form.headline||"Your headline appears here"}</h2><p className="cloud-summary">{form.summary||"A concise summary introduces the announcement."}</p><small>{form.dateline||"CITY — DATE"}</small>{form.body.trim().split(/\n\s*\n/).filter(Boolean).map((p,i)=><p key={i}>{p}</p>)}{form.quote_text&&<blockquote>“{form.quote_text}”{form.quote_attribution&&<cite> — {form.quote_attribution}</cite>}</blockquote>}{form.boilerplate&&<p><strong>About {form.issuer||"the organization"}</strong><br/>{form.boilerplate}</p>}<div className="cloud-preview-badge">DRAFT · NOT PUBLISHED</div></section>
             {editingId&&<section className="cloud-panel cloud-assets"><span className="cloud-tag">PRIVATE MEDIA STORAGE</span><h2>Supporting files</h2><p>Upload one PDF or image at a time, up to 10 MB. Files are private to authorized organization members.</p><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={e=>{const file=e.target.files?.[0];if(file)uploadAsset(file);e.currentTarget.value="";}}/><div className="cloud-assets-list">{assets.map(a=><button key={a.id} onClick={()=>openAsset(a)}><CloudArrowUpIcon width={17}/>{a.file_name}<span>{Math.round(a.byte_size/1024)} KB</span></button>)}</div>{uploading&&<small>Uploading…</small>}</section>}
             </aside></div>}
           </>}
           {tab==="team"&&<><div className="cloud-heading"><div><span className="cloud-tag">ORGANIZATION ACCESS</span><h1>People and permissions</h1><p>Keep each organization's content accessible only to authorized team members.</p></div></div>
             <div className="cloud-two-col"><section className="cloud-panel cloud-team"><h2>Organization members</h2><p>Your role: <strong>{org?.role}</strong></p>{members.map(m=><div className="cloud-member" key={m.user_id}><span><UsersIcon width={18}/>{m.user_id===userId?userEmail||"You":m.user_id.slice(0,8)+"…"}</span><b>{m.role}</b></div>)}</section>
               <section className="cloud-panel cloud-team"><h2>Invite a collaborator</h2><p>Invitations are matched against a verified login email. Pubbblic doesn't expose organization records to people who haven't accepted an invite.</p>{canInvite?<form onSubmit={inviteMember}><Field title="Email address" required><input required type="email" maxLength={254} value={inviteEmail} placeholder="teammate@company.com" onChange={e=>setInviteEmail(e.target.value)}/></Field><Field title="Role"><select value={inviteRole} onChange={e=>setInviteRole(e.target.value as typeof inviteRole)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select></Field><button className="cloud-button" disabled={busy} type="submit">Create invitation <ArrowRightIcon width={16}/></button></form>:<p>Only organization owners and admins can invite members.</p>}</section>
             </div></>}
           {tab==="settings"&&<><div className="cloud-heading"><div><span className="cloud-tag">ACCOUNT & SECURITY</span><h1>Workspace settings</h1><p>Access and storage controls for your organization.</p></div></div>
             <section className="cloud-panel cloud-team"><h2>Your account</h2><p><strong>Authenticated email:</strong> {userEmail}</p><p><strong>Active organization:</strong> {org?.name}</p><p><strong>Access role:</strong> {org?.role}</p><p><strong>Release storage:</strong> Supabase PostgreSQL with RLS and immutable version snapshots</p><p><strong>Media:</strong> private bucket, scoped storage policies, temporary signed links</p><p><strong>Live publisher distribution:</strong> disabled pending security and permissions review</p><button className="cloud-button secondary" onClick={signOut} disabled={busy}>Sign out</button></section>
           </>}
         </>}
       </>}
     </div>
     <footer className="cloud-footer"><span>© {new Date().getUTCFullYear()} Pubbblic · a <a href="https://mahtco.com" target="_blank" rel="noopener noreferrer">Mahtco</a> company</span><span>Tenant-secured drafting · Distribution disabled</span></footer>
   </div>
 </div>;
}
