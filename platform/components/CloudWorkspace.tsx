"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
 ArrowDownTrayIcon, ArrowLeftIcon, ArrowRightIcon, BuildingOfficeIcon, CheckCircleIcon,
 ChevronDownIcon, ClockIcon, CloudArrowUpIcon, DocumentTextIcon, ExclamationCircleIcon,
 GlobeAltIcon, LockClosedIcon, PlusIcon, ShieldCheckIcon, UsersIcon, XMarkIcon
} from "@heroicons/react/24/outline";
import { createClient } from "@/lib/supabase/browser";
import { wordCount } from "@/lib/release";
import { ReleaseBodyEditor, renderReleaseBody } from "@/components/ReleaseBodyEditor";
import {EditorialWorkspace} from "@/components/EditorialWorkspace";

type Role = "owner" | "admin" | "editor" | "viewer";
type Org = { id:string; name:string; role:Role };
type Invitation = {invitation_id:string;organization_name:string;invited_role:string;expires_at:string};
type PendingInvitation = {
 id:string; email:string; role:string; invited_at:string; expires_at:string;
 accepted_at:string|null; notification_state:"not_sent"|"sending"|"sent"|"failed";
 notification_sent_at:string|null; notification_last_attempt_at:string|null;
 notification_send_count:number; notification_attempt_count:number;
 notification_delivery_provider:string|null; notification_last_error:string|null;
};
type Membership = {user_id:string;role:Role;created_at:string};
type AccessEvent={id:string;event_type:string;before_role:string|null;after_role:string|null;created_at:string;actor_id:string|null};
type ReleaseForm = {
 headline:string; summary:string; issuer:string; dateline:string;
 category:string; body:string; body_format:"plain"|"markdown"; quote_text:string; quote_attribution:string;
 boilerplate:string; contact_name:string; contact_email:string;
};
type Release = ReleaseForm & {
 id:string; organization_id:string; created_by:string;
 version:number; status:string; updated_at:string; created_at:string; archived_at:string|null;
};
type Asset = {id:string;object_path:string;file_name:string;mime_type:string;byte_size:number};
type ReleaseRevision = {version:number;created_at:string;actor_id:string|null;snapshot:Release};
type SaveStatus = "idle"|"dirty"|"saving"|"saved"|"conflict"|"error";
type Tab = "home"|"releases"|"editor"|"review"|"team"|"settings";
const blank:ReleaseForm={headline:"",summary:"",issuer:"",dateline:"",category:"Company news",body:"",body_format:"markdown",quote_text:"",quote_attribution:"",boilerplate:"",contact_name:"",contact_email:""};
const categories=["Company news","Product launch","Partnership","Milestone","Event","Other"];
function fmtDate(raw:string){return new Date(raw).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function short(error:unknown){return error instanceof Error?error.message:"Request failed. Try again.";}
function Logo(){return <div className="cloud-logo"><b>pubbblic<span>.</span></b><small>STUDIO</small></div>}
function Field({title,required=false,children,hint}:{title:string;required?:boolean;children:React.ReactNode;hint?:string}){
 return <label className="cloud-field"><span>{title}{required&&<b> *</b>}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
export function CloudWorkspace({userId,userEmail,initialOrgId="",initialTab="home"}:{
 userId:string;userEmail:string;initialOrgId?:string;initialTab?:"home"|"releases"|"editor"|"review"|"team"|"settings"
}){
 const supabase=useMemo(()=>createClient(),[]);
 const router=useRouter();
 const [orgs,setOrgs]=useState<Org[]>([]);
 const [orgId,setOrgId]=useState(initialOrgId);
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [pendingInvitations,setPendingInvitations]=useState<PendingInvitation[]>([]);
 const [releases,setReleases]=useState<Release[]>([]);
 const [members,setMembers]=useState<Membership[]>([]);
 const [accessEvents,setAccessEvents]=useState<AccessEvent[]>([]);
 const [assets,setAssets]=useState<Asset[]>([]);
 const [tab,setTab]=useState<Tab>(initialTab);
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
 const [checklistOpen,setChecklistOpen]=useState(false);
 const [saveStatus,setSaveStatus]=useState<SaveStatus>("idle");
 const [lastSavedAt,setLastSavedAt]=useState<string|null>(null);
 const [changeCount,setChangeCount]=useState(0);
 const editSerialRef=useRef(0);
 const editorSessionRef=useRef(0);
 const savingRef=useRef(false);
 const [history,setHistory]=useState<ReleaseRevision[]>([]);
 const [selectedRevision,setSelectedRevision]=useState<number|null>(null);

 const org=orgs.find(x=>x.id===orgId);
 const canWrite=org?.role==="owner"||org?.role==="admin"||org?.role==="editor";
 const canInvite=org?.role==="owner"||org?.role==="admin";
 useEffect(()=>{
   if(tab==="editor"&&orgs.length>0&&!canWrite)setTab("home");
 },[tab,orgs.length,canWrite]);
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
 const loadAccessEvents=useCallback(async(id:string)=>{
   const {data,error:e}=await supabase.from("organization_access_events")
    .select("id,event_type,before_role,after_role,created_at,actor_id")
    .eq("organization_id",id).order("created_at",{ascending:false}).limit(30);
   if(e)throw e;
   setAccessEvents((data||[]) as AccessEvent[]);
 },[supabase]);
 const loadPendingInvitations=useCallback(async(id:string)=>{
   const {data,error:e}=await supabase.from("organization_invitations")
     .select("id,email,role,invited_at,expires_at,accepted_at,notification_state,notification_sent_at,notification_last_attempt_at,notification_send_count,notification_attempt_count,notification_delivery_provider,notification_last_error")
     .eq("organization_id",id).is("accepted_at",null).is("cancelled_at",null)
     .order("invited_at",{ascending:false});
   if(e)throw e;
   setPendingInvitations((data||[]) as PendingInvitation[]);
 },[supabase]);
 const loadHistory=useCallback(async(id:string)=>{
   const {data,error:e}=await supabase.from("press_release_versions")
     .select("version,created_at,actor_id,snapshot").eq("release_id",id)
     .order("version",{ascending:false}).limit(30);
   if(e)throw e;
   setHistory((data||[]) as ReleaseRevision[]);
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
   if(!orgId){setReleases([]);setMembers([]);setPendingInvitations([]);return;}
   loadReleases(orgId).catch(e=>setError("Could not load releases: "+short(e)));
   loadMembers(orgId).catch(e=>setError("Could not load team members: "+short(e)));
   loadPendingInvitations(orgId).catch(e=>setError("Could not load pending invitations: "+short(e)));
   if(canInvite)loadAccessEvents(orgId).catch(e=>setError("Could not load access audit: "+short(e)));
 },[orgId,loadReleases,loadMembers,loadPendingInvitations,loadAccessEvents,canInvite]);
 useEffect(()=>{
   if(editingId){
     loadAssets(editingId).catch(e=>setError("Could not load attachments: "+short(e)));
     loadHistory(editingId).catch(e=>setError("Could not load revision history: "+short(e)));
   }else{setAssets([]);setHistory([]);}
 },[editingId,loadAssets,loadHistory]);
 useEffect(()=>{
   if(saveStatus!=="dirty")return;
   const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};
   window.addEventListener("beforeunload",warn);
   return ()=>window.removeEventListener("beforeunload",warn);
 },[saveStatus]);
 useEffect(()=>{
   if(saveStatus!=="dirty"||tab!=="editor"||!canWrite||busy)return;
   if(!form.headline.trim()&&!form.body.trim())return;
   const timer=window.setTimeout(()=>{void saveRelease(undefined,true);},2700);
   return ()=>window.clearTimeout(timer);
 // Only user changes and save state schedule writes. The optimistic version
 // check in saveRelease protects against concurrent browser sessions.
 },[changeCount,saveStatus,tab,canWrite,busy,editingVersion,editingId]);

 function switchTab(next:Tab){
   if(tab==="editor"&&next!=="editor"){
     if(saveStatus==="dirty"&&!window.confirm("This draft has unsaved edits. Leave without saving?"))return;
     editorSessionRef.current++;
     setSaveStatus("idle");setEditingId(null);setSelectedRevision(null);
   }
   setTab(next);setNotice("");setError("");setMobileOpen(false);window.scrollTo({top:0,behavior:"smooth"});
 }
 function newRelease(){
   if(saveStatus==="dirty"&&!window.confirm("Discard unsaved edits and create a new draft?"))return;
   editorSessionRef.current++;
   setForm({...blank});setEditingId(null);setEditingVersion(0);setSaveStatus("idle");setLastSavedAt(null);setSelectedRevision(null);
   switchTab("editor");
 }
 function editRelease(release:Release){
   if(!["draft","changes_requested"].includes(release.status)){switchTab("review");return;}
   if(saveStatus==="dirty"&&!window.confirm("Discard unsaved edits and open this release?"))return;
   editorSessionRef.current++;
   const fields=Object.keys(blank) as (keyof ReleaseForm)[];
   const value={...blank};
   for(const key of fields){
     if(key==="body_format")value.body_format=release.body_format==="markdown"?"markdown":"plain";
     else value[key]=release[key]??blank[key];
   }
   setForm(value);setEditingId(release.id);setEditingVersion(release.version);
   setSaveStatus("saved");setLastSavedAt(release.updated_at);setSelectedRevision(null);
   switchTab("editor");
 }
 function field<K extends keyof ReleaseForm>(key:K,value:ReleaseForm[K]){
   editSerialRef.current++;
   setChangeCount(editSerialRef.current);
   setSaveStatus("dirty");
   setForm(old=>({...old,[key]:value}));
   setNotice("");
 }
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

 async function sendInvitationEmail(invitationId:string):Promise<{ok:boolean;reason?:string}>{
   const {data,error:e}=await supabase.functions.invoke("notify-organization-invitation",{
     body:{invitation_id:invitationId}
   });
   if(!e && data?.email_request_accepted)return {ok:true};
   let code:string|undefined = data?.error;
   if(e && "context" in e && e.context instanceof Response){
     try{
       const serverData=await e.context.clone().json();
       code=typeof serverData?.error==="string"?serverData.error:code;
     }catch{}
   }
   if(code==="auth_email_request_failed")return {ok:false,reason:"Invitation saved, but Supabase Auth could not send the verification email. Check Supabase email logs and SMTP settings."};
   if(code==="invitation_cooldown"||code==="invitation_cooldown_or_changed")return {ok:false,reason:"The invitation is saved. Please wait two minutes before sending again."};
   if(code==="invitation_send_limit")return {ok:false,reason:"The invitation is saved, but its email-send limit has been reached."};
   if(code==="invitation_origin_not_configured")return {ok:false,reason:"Invitation saved. Configure the authorized Pubbblic app URL for email redirects before retrying."};
   if(code==="not_authorized")return {ok:false,reason:"Only organization owners and admins can email invitations."};
   return {ok:false,reason:"The invitation remains saved, but email delivery could not be requested. Copy the join link or try again later."};
 }
 async function inviteMember(e:React.FormEvent){
   e.preventDefault();if(!orgId||!canInvite)return;
   setBusy(true);setError("");setNotice("");
   try{
     const {data:invitationId,error:e}=await supabase.rpc("invite_organization_member",{
       p_organization_id:orgId,p_email:inviteEmail.trim().toLowerCase(),p_role:inviteRole
     });
     if(e)throw e;
     await loadPendingInvitations(orgId);
     const delivery=await sendInvitationEmail(String(invitationId));
     await loadPendingInvitations(orgId);
     setNotice(delivery.ok
       ?"Invitation saved. Supabase accepted an OTP email request. The email contains a Join workspace link when the Auth email template includes it."
       :delivery.reason||"Invitation saved, but an email was not sent.");
     setInviteEmail("");
   }catch(e){setError(short(e));}
   finally{setBusy(false);}
 }
 async function copyInvitationLink(invitationId:string){
   setError("");setNotice("");
   try{
     await navigator.clipboard.writeText(window.location.origin+"/invite/"+invitationId);
     setNotice("Invite link copied. Share it with the intended recipient. They must verify the invited email address and explicitly accept.");
   }catch{
     setError("Could not copy the link. Your browser may require Clipboard permission or HTTPS.");
   }
 }

 async function resendInvitation(invitationId:string){
   if(!orgId||!canInvite)return;
   setBusy(true);setError("");setNotice("");
   try{
     const delivery=await sendInvitationEmail(invitationId);
     await loadPendingInvitations(orgId);
     setNotice(delivery.ok
       ?"Supabase accepted the verification email request. Recipient must verify the invited address and accept membership."
       :delivery.reason||"The invitation remains saved; email could not be sent.");
   }catch(e){setError(short(e));}
   finally{setBusy(false);}
 }
 async function saveRelease(e?:React.FormEvent,automatic=false){
   e?.preventDefault();
   if(!orgId||!canWrite||savingRef.current)return;
   if(automatic&&(!form.headline.trim()&&!form.body.trim()))return;
   savingRef.current=true;
   const pendingSequence=editSerialRef.current;
   const session=editorSessionRef.current;
   const snapshot={...form};
   const savedId=editingId;
   const savedVersion=editingVersion;
   if(!automatic)setBusy(true);
   setSaveStatus("saving");setError("");if(!automatic)setNotice("");
   try{
     let saved:Release;
     if(savedId){
       const {data,error:e}=await supabase.from("press_releases")
         .update({...snapshot,version:savedVersion+1})
         .eq("id",savedId).eq("organization_id",orgId).eq("version",savedVersion)
         .in("status",["draft","changes_requested"]).select("*").maybeSingle();
       if(e)throw e;
       if(!data)throw new Error("VERSION_CONFLICT: Another session saved a newer revision. Copy your edits, then reopen the release before saving.");
       saved=data as Release;
     }else{
       const {data,error:e}=await supabase.from("press_releases").insert({
         ...snapshot,organization_id:orgId,created_by:userId,status:"draft",version:1
       }).select("*").single();
       if(e)throw e;
       saved=data as Release;
     }
     if(editorSessionRef.current===session){
       setEditingId(saved.id);setEditingVersion(saved.version);setLastSavedAt(saved.updated_at);
       setSaveStatus(editSerialRef.current===pendingSequence?"saved":"dirty");
       if(!automatic)setNotice("Draft saved privately. Revision "+saved.version+" recorded.");
       await loadHistory(saved.id);
     }
     await loadReleases(orgId);
   }catch(err){
     if(editorSessionRef.current===session){
       const message=short(err);
       setSaveStatus(message.includes("VERSION_CONFLICT")||message.includes("version_conflict")?"conflict":"error");
       setError(message.replace("VERSION_CONFLICT: ",""));
     }
   }finally{
     savingRef.current=false;
     if(!automatic)setBusy(false);
   }
 }
 async function restoreRevision(revision:ReleaseRevision){
   if(!orgId||!editingId||!canWrite||savingRef.current||busy)return;
   if(saveStatus==="dirty"||saveStatus==="saving"){
     setError("Save or discard your current edits before restoring a revision.");return;
   }
   if(!window.confirm("Restore revision "+revision.version+" as a NEW draft revision? Existing history will remain unchanged."))return;
   setBusy(true);setError("");setNotice("");savingRef.current=true;
   try{
     const fields=Object.keys(blank) as (keyof ReleaseForm)[];
     const snapshot={...blank};
     for(const key of fields){
       if(key==="body_format")snapshot.body_format=revision.snapshot.body_format==="markdown"?"markdown":"plain";
       else snapshot[key]=revision.snapshot[key]??blank[key];
     }
     const {data,error:e}=await supabase.from("press_releases")
       .update({...snapshot,version:editingVersion+1})
       .eq("id",editingId).eq("organization_id",orgId).in("status",["draft","changes_requested"])
       .eq("version",editingVersion).select("*").maybeSingle();
     if(e)throw e;
     if(!data)throw new Error("Restore conflict: a newer revision exists. Refresh before restoring.");
     setForm(snapshot);setEditingVersion(data.version);setLastSavedAt(data.updated_at);
     setSaveStatus("saved");setSelectedRevision(null);
     setNotice("Revision "+revision.version+" restored as new revision "+data.version+". Earlier versions remain immutable.");
     await Promise.all([loadReleases(orgId),loadHistory(editingId)]);
   }catch(e){setError(short(e));}
   finally{savingRef.current=false;setBusy(false);}
 }
 async function openReviewDraft(id:string){
   const {data,error:e}=await supabase.from("press_releases").select("*")
     .eq("organization_id",orgId).eq("id",id).maybeSingle();
   if(e||!data){setError(e?.message||"Draft unavailable.");return;}
   await loadReleases(orgId);
   editRelease(data as Release);
 }
 async function changeMemberRole(memberId:string,next:Role){
   if(!orgId||!canInvite||busy||!window.confirm("Change this member's role to "+next+"?"))return;
   setBusy(true);setError("");setNotice("");
   try{
     const {data,error:e}=await supabase.from("organization_memberships")
      .update({role:next}).eq("organization_id",orgId).eq("user_id",memberId).select("user_id").maybeSingle();
     if(e)throw e;if(!data)throw new Error("Permission denied or membership not found.");
     await Promise.all([loadMembers(orgId),loadAccessEvents(orgId)]);
     if(memberId===userId)await loadOrgs();
     setNotice("Role change saved with a security audit record.");
   }catch(e){setError(short(e));}finally{setBusy(false);}
 }
 async function removeMember(memberId:string){
   if(!orgId||!canInvite||busy||!window.confirm("Remove this person from the organization? Their access will be revoked."))return;
   setBusy(true);setError("");setNotice("");
   try{
     const {data,error:e}=await supabase.from("organization_memberships")
      .delete().eq("organization_id",orgId).eq("user_id",memberId).select("user_id").maybeSingle();
     if(e)throw e;if(!data)throw new Error("Permission denied or membership not found.");
     await Promise.all([loadMembers(orgId),loadAccessEvents(orgId)]);
     if(memberId===userId)await loadOrgs();
     setNotice("Member removed and recorded in the security audit.");
   }catch(e){setError(short(e));}finally{setBusy(false);}
 }
 async function cancelInvitation(invitationId:string){
   if(!orgId||!canInvite||busy||!window.confirm("Revoke this invitation? The recipient will no longer be able to join."))return;
   setBusy(true);setError("");setNotice("");
   try{
     const {data,error:e}=await supabase.from("organization_invitations")
      .update({cancelled_at:new Date().toISOString()})
      .eq("organization_id",orgId).eq("id",invitationId).is("accepted_at",null)
      .select("id").maybeSingle();
     if(e)throw e;if(!data)throw new Error("Invitation unavailable or already accepted.");
     await Promise.all([loadPendingInvitations(orgId),loadAccessEvents(orgId)]);
     setNotice("Invitation revoked; future email sends and acceptance are blocked.");
   }catch(e){setError(short(e));}finally{setBusy(false);}
 }
 async function signOutEverywhere(){
   setBusy(true);setError("");
   const {error:e}=await supabase.auth.signOut({scope:"global"});
   if(e){setError(e.message);setBusy(false);return;}
   router.replace("/login");router.refresh();
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
 const orgSwitcher=<select aria-label="Selected organization" value={orgId} onChange={e=>{
   if(tab==="editor"&&saveStatus==="dirty"&&!window.confirm("Unsaved edits will be lost when switching organizations. Continue?"))return;
   editorSessionRef.current++;setOrgId(e.target.value);setSaveStatus("idle");setEditingId(null);setSelectedRevision(null);
   setTab("home");setError("");setNotice("");setMobileOpen(false);
 }}>
   {orgs.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}
 </select>;
 return <div className="cloud-app">
   <aside className={"cloud-sidebar "+(mobileOpen?"opened":"")}>
     <div className="cloud-sidebar-head"><Logo/><button className="cloud-close" onClick={()=>setMobileOpen(false)} aria-label="Close menu"><XMarkIcon width={22}/></button></div>
     <div className="cloud-org-picker"><div className="cloud-small-label">CURRENT ORGANIZATION</div>{orgs.length?orgSwitcher:<span>Set up a workspace</span>}</div>
     <nav className="cloud-nav" aria-label="Workspace navigation">
       {([{key:"home",label:"Overview",icon:BuildingOfficeIcon},{key:"releases",label:"Press releases",icon:DocumentTextIcon},{key:"editor",label:"Release editor",icon:PlusIcon},{key:"review",label:"Editorial reviews",icon:ShieldCheckIcon},{key:"team",label:"Team & invitations",icon:UsersIcon},{key:"settings",label:"Account settings",icon:ShieldCheckIcon}] as const).map(item=>
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
             <section className="cloud-panel cloud-list"><div className="cloud-panel-head"><h2>{releases.length} active release{releases.length===1?"":"s"}</h2><span>Organization: {org?.name}</span></div>
               {!releases.length?<div className="cloud-empty"><DocumentTextIcon width={28}/><p>No releases yet.</p></div>:releases.map(r=><div className="cloud-release-item" key={r.id}><DocumentTextIcon width={22}/><div><strong>{r.headline||"Untitled draft"}</strong><small>{r.category} · {r.status.replaceAll("_"," ")} · Version {r.version} · {fmtDate(r.updated_at)}</small></div><button onClick={()=>editRelease(r)}>{["draft","changes_requested"].includes(r.status)?"Edit":"Review"}</button>{canWrite&&r.status==="draft"&&<button className="cloud-archive" onClick={()=>archiveRelease(r)} disabled={busy}>Archive</button>}</div>)}
             </section></>}
           {tab==="editor"&&<><div className="cloud-heading cloud-editor-heading"><div><button className="cloud-back" onClick={()=>switchTab("releases")}><ArrowLeftIcon width={16}/> Back to releases</button><span className="cloud-tag">RELEASE EDITOR</span><h1>{editingId?"Edit press release":"Create a press release"}</h1><p>Autosave keeps your draft private. Every successful save preserves an immutable revision.</p><div className="studio-save-indicator" role="status" aria-live="polite">{saveStatus==="saving"?"Saving…":saveStatus==="dirty"?"Unsaved edits — autosave pending":saveStatus==="saved"?"All changes saved":saveStatus==="conflict"?"Conflict — reopen before saving":saveStatus==="error"?"Save failed — retry":"New unsaved draft"}{lastSavedAt&&<small> · {new Date(lastSavedAt).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}</small>}</div></div>{canWrite&&<button className="cloud-button" onClick={()=>saveRelease()} disabled={busy||saveStatus==="saving"}>{busy||saveStatus==="saving"?"Saving…":"Save now"} <ArrowRightIcon width={17}/></button>}</div>
             {!canWrite?<div className="cloud-panel cloud-empty"><LockClosedIcon width={27}/><p>This organization role is read-only.</p></div>:<div className="cloud-editor-layout"><form className="cloud-panel cloud-editor cloud-editor-wide" onSubmit={saveRelease}>
               <h2>Announcement details</h2><Field title="Headline" required hint={form.headline.length+"/140 characters"}><input maxLength={140} value={form.headline} onChange={e=>field("headline",e.target.value)} placeholder="Company announces a verified new milestone"/></Field>
               <Field title="Summary" required hint={form.summary.length+"/320 characters"}><textarea maxLength={320} rows={3} value={form.summary} onChange={e=>field("summary",e.target.value)} placeholder="Summarize what happened and who it affects."/></Field>
               <div className="cloud-fields-two"><Field title="Organization / issuer"><input value={form.issuer} maxLength={160} onChange={e=>field("issuer",e.target.value)} placeholder="Company name"/></Field><Field title="Announcement type"><select value={form.category} onChange={e=>field("category",e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field></div>
               <Field title="Dateline"><input value={form.dateline} maxLength={180} onChange={e=>field("dateline",e.target.value)} placeholder="CITY, State — Month Day, Year"/></Field>
               <h2>Release body</h2><Field title="Press release body" required hint={wordCount(form.body)+" words (60 recommended for draft readiness)"}>
                <ReleaseBodyEditor value={form.body} format={form.body_format} onChange={(body,bodyFormat)=>{
                  editSerialRef.current++;setChangeCount(editSerialRef.current);setSaveStatus("dirty");
                  setForm(old=>({...old,body,body_format:bodyFormat}));setNotice("");
                }}/>
               </Field>
               <div className="cloud-fields-two"><Field title="Approved quote (optional)"><textarea rows={3} maxLength={5000} value={form.quote_text} onChange={e=>field("quote_text",e.target.value)}/></Field><Field title="Quote attribution"><input maxLength={500} value={form.quote_attribution} onChange={e=>field("quote_attribution",e.target.value)} placeholder="Name and title"/></Field></div>
               <Field title="Company boilerplate"><textarea rows={3} maxLength={10000} value={form.boilerplate} onChange={e=>field("boilerplate",e.target.value)}/></Field>
               <h2>Media contact</h2><div className="cloud-fields-two"><Field title="Contact name"><input value={form.contact_name} maxLength={160} onChange={e=>field("contact_name",e.target.value)}/></Field><Field title="Contact email"><input type="email" value={form.contact_email} maxLength={254} onChange={e=>field("contact_email",e.target.value)}/></Field></div>
               <button className="cloud-button" type="submit" disabled={busy||saveStatus==="saving"}>{busy||saveStatus==="saving"?"Saving…":editingId?"Save now":"Create draft"} <ArrowRightIcon width={17}/></button>
             </form>
             <section className="cloud-panel cloud-release-preview cloud-release-preview-wide" aria-label="Live draft preview">
               <div className="cloud-preview-heading">
                 <div><span className="cloud-tag">LIVE DRAFT PREVIEW</span><p>Review the complete announcement as your readers would see it. Changes appear here instantly.</p></div>
                 <span className="cloud-preview-state">DRAFT · NOT PUBLISHED</span>
               </div>
               <article className="cloud-preview-document">
                 <h2>{form.headline||"Your headline appears here"}</h2>
                 <p className="cloud-summary">{form.summary||"A concise summary introduces the announcement."}</p>
                 <div className="cloud-preview-dateline">{form.dateline||"CITY — DATE"}</div>
                 {form.body.trim()?renderReleaseBody(form.body,form.body_format):<p>Start writing the announcement to preview it here.</p>}
                 {form.quote_text&&<blockquote>“{form.quote_text}”{form.quote_attribution&&<cite> — {form.quote_attribution}</cite>}</blockquote>}
                 {form.boilerplate&&<div className="cloud-preview-section"><h3>About {form.issuer||"the organization"}</h3><p>{form.boilerplate}</p></div>}
                 {(form.contact_name||form.contact_email)&&<div className="cloud-preview-section"><h3>Media contact</h3><p>{form.contact_name}{form.contact_name&&form.contact_email&&<br/>}{form.contact_email}</p></div>}
               </article>
               <div className="cloud-preview-footer">Private workspace preview · No publishing action is performed here.</div>
             </section>
             {editingId&&<section className="cloud-panel studio-revisions cloud-assets-wide" aria-label="Release revision history">
               <div className="studio-revisions-header"><div><span className="cloud-tag">VERSION HISTORY</span><h2>Draft revisions</h2><p>Up to 30 latest immutable snapshots. Restoring always creates a new revision.</p></div><span>Current · v{editingVersion}</span></div>
               <div className="studio-revisions-list">{history.map(rev=><div className="studio-revision-row" key={rev.version}>
                 <div><strong>Revision {rev.version}</strong><small>{fmtDate(rev.created_at)} · {rev.actor_id===userId?"You":"Team member"}</small></div>
                 <div><button type="button" className="cloud-button secondary" onClick={()=>setSelectedRevision(old=>old===rev.version?null:rev.version)}>{selectedRevision===rev.version?"Hide comparison":"Compare"}</button>
                   {rev.version!==editingVersion&&<button type="button" className="cloud-button secondary" disabled={busy||saveStatus==="saving"} onClick={()=>restoreRevision(rev)}>Restore</button>}</div>
               </div>)}</div>
               {selectedRevision!==null&&(()=>{
                 const old=history.find(x=>x.version===selectedRevision);
                 if(!old)return null;
                 return <div className="studio-revision-compare"><h3>Compare revision {selectedRevision} with current draft</h3>
                   <div className="studio-compare-columns">
                     <div><strong>Revision {selectedRevision}</strong><h4>{old.snapshot.headline}</h4><pre>{old.snapshot.body}</pre></div>
                     <div><strong>Current editor</strong><h4>{form.headline}</h4><pre>{form.body}</pre></div>
                   </div>
                 </div>;
               })()}
             </section>}
             {editingId&&<section className="cloud-panel cloud-assets cloud-assets-wide"><span className="cloud-tag">PRIVATE MEDIA STORAGE</span><h2>Supporting files</h2><p>Upload one PDF or image at a time, up to 10 MB. Files are private to authorized organization members.</p><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={e=>{const file=e.target.files?.[0];if(file)uploadAsset(file);e.currentTarget.value="";}}/><div className="cloud-assets-list">{assets.map(a=><button key={a.id} onClick={()=>openAsset(a)}><CloudArrowUpIcon width={17}/>{a.file_name}<span>{Math.round(a.byte_size/1024)} KB</span></button>)}</div>{uploading&&<small>Uploading…</small>}</section>}
             <aside className="cloud-checklist-dock" aria-label="Editorial completeness">
               <section id="cloud-checklist-details" className="cloud-checklist-details" role="region" aria-label="Editorial checks" hidden={!checklistOpen}>
                 <div className="cloud-checklist-details-header"><span className="cloud-tag">EDITORIAL COMPLETENESS</span><strong>{checksDone} of {checks.length} checks passed</strong></div>
                 <div className="cloud-checklist-progress"><span style={{width:(checksDone/checks.length*100)+"%"}}/></div>
                 <ul>{checks.map(c=><li key={c.label}><span className={c.valid?"ok":"pending"}>{c.valid?<CheckCircleIcon width={19}/>:<ExclamationCircleIcon width={19}/>}</span><span>{c.label}</span></li>)}</ul>
                 <p>These are drafting checks—not publisher acceptance or verified factual approval.</p>
               </section>
               <button type="button" className="cloud-checklist-trigger" onClick={()=>setChecklistOpen(open=>!open)} aria-expanded={checklistOpen} aria-controls="cloud-checklist-details">
                 <span className="cloud-checklist-trigger-icon"><ShieldCheckIcon width={21}/></span>
                 <span className="cloud-checklist-trigger-label"><strong>Editorial completeness</strong><small>{checksDone}/{checks.length} checks passed</small></span>
                 <span className="cloud-checklist-trigger-count">{checksDone}/{checks.length}</span>
                 <ChevronDownIcon width={18} className={checklistOpen?"cloud-checklist-chevron open":"cloud-checklist-chevron"}/>
               </button>
               <div className="cloud-checklist-mini-progress" aria-hidden="true"><span style={{width:(checksDone/checks.length*100)+"%"}}/></div>
             </aside>
           </div>}
           </>}
           {tab==="review"&&org&&<EditorialWorkspace key={org.id} organizationId={org.id}
              role={org.role} userId={userId} onOpenDraft={openReviewDraft}/>}
           {tab==="team"&&<><div className="cloud-heading"><div><span className="cloud-tag">ORGANIZATION ACCESS</span><h1>People and permissions</h1><p>Manage accepted members and pending invitations separately.</p></div></div>
             <div className="cloud-two-col"><section className="cloud-panel cloud-team"><h2>Organization members</h2><p>Your role: <strong>{org?.role}</strong></p>{members.map(m=><div className="cloud-member" key={m.user_id}><span><UsersIcon width={18}/>{m.user_id===userId?userEmail||"You":m.user_id.slice(0,8)+"…"}</span>
                <div className="studio-member-actions">{canInvite?
                  <><select aria-label={"Member role "+m.user_id.slice(0,8)} value={m.role} disabled={busy}
                     onChange={e=>void changeMemberRole(m.user_id,e.target.value as Role)}>
                    {(["owner","admin","editor","viewer"] as const).filter(r=>org?.role==="owner"||r!=="owner").map(r=><option value={r} key={r}>{r}</option>)}
                   </select><button className="cloud-button secondary" disabled={busy} type="button" onClick={()=>void removeMember(m.user_id)}>Remove</button></>:
                  <b>{m.role}</b>}</div></div>)}</section>
               <section className="cloud-panel cloud-team"><h2>Invite a collaborator</h2><p>Invite a new or existing user. Supabase Auth sends the verification code through the configured Zoho SMTP; Pubbblic stores the role and grants access only after acceptance.</p>{canInvite?<form onSubmit={inviteMember}><Field title="Email address" required><input required type="email" maxLength={254} value={inviteEmail} placeholder="teammate@company.com" onChange={e=>setInviteEmail(e.target.value)}/></Field><Field title="Role"><select value={inviteRole} onChange={e=>setInviteRole(e.target.value as typeof inviteRole)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select></Field><button className="cloud-button" disabled={busy} type="submit">{busy?"Processing…":"Create invitation & send email"} <ArrowRightIcon width={16}/></button></form>:<p>Only organization owners and admins can invite members.</p>}</section>
             </div>
             {canInvite&&<section className="cloud-panel cloud-pending-invitations">
               <div className="cloud-panel-head"><div><h2>Pending invitations</h2><p>Invitation records are saved in Supabase; an email request is a separate step.</p></div><span>{pendingInvitations.length} pending</span></div>
               {pendingInvitations.length===0?<div className="cloud-empty"><UsersIcon width={27}/><p>No pending invitations for this organization.</p></div>:
                 pendingInvitations.map(inv=>{
                   const recentlyAttempted=!!inv.notification_last_attempt_at && Date.now()-new Date(inv.notification_last_attempt_at).getTime()<120000;
                   const expired=new Date(inv.expires_at).getTime()<=Date.now();
                   const limitReached=inv.notification_send_count>=5 || inv.notification_attempt_count>=10;
                   return <div className="cloud-pending-row" key={inv.id}>
                     <div className="cloud-pending-person"><strong>{inv.email}</strong><span>{inv.role} · expires {fmtDate(inv.expires_at)}</span></div>
                     <div className="cloud-pending-state">
                       <span className={"cloud-pending-status "+(inv.notification_state==="sent"?"sent":"")}>{inv.notification_state==="sent"?(inv.notification_delivery_provider==="supabase_auth"?"OTP requested":"Previous email requested"):inv.notification_state==="failed"?"Delivery failed":inv.notification_state==="sending"?"Sending…":"Not sent"}</span>
                       {inv.notification_sent_at&&<small>Auth request accepted {fmtDate(inv.notification_sent_at)}</small>}
                       {inv.notification_last_error&&<small>Last attempt: {inv.notification_last_error.replaceAll("_"," ")}</small>}
                     </div>
                     <div className="cloud-invite-row-actions">
                       <button className="cloud-button secondary" type="button" disabled={expired||busy} onClick={()=>copyInvitationLink(inv.id)}>Copy join link</button>
                       <button className="cloud-button secondary" type="button" disabled={busy||recentlyAttempted||expired||limitReached} onClick={()=>resendInvitation(inv.id)}>
                         {expired?"Expired":limitReached?"Send limit reached":recentlyAttempted?"Try again later":inv.notification_sent_at?"Resend verification":"Send verification"}
                       </button>
                       <button className="cloud-button secondary" type="button" disabled={busy} onClick={()=>void cancelInvitation(inv.id)}>Revoke invitation</button>
                     </div>
                   </div>;
                 })}
               <p className="cloud-pending-footnote">Supabase Auth sends a code through your existing Zoho SMTP. If the email template includes a Join workspace link, recipients can open the invite directly; otherwise use Copy join link. Only the matching verified account can accept a role.</p>
             </section>}
             {canInvite&&<section className="cloud-panel studio-access-audit"><h2>Access audit</h2>
               <p>Role changes, removals and invitation revocations are recorded. Only owners and admins may view this log.</p>
               {accessEvents.length===0?<p>No access changes recorded.</p>:accessEvents.map(entry=>
               <div className="studio-access-event" key={entry.id}><strong>{entry.event_type.replaceAll("_"," ")}</strong>
               <span>{entry.before_role||"—"} → {entry.after_role||"—"}</span><small>{fmtDate(entry.created_at)}</small></div>)}
             </section>}
           </>}
           {tab==="settings"&&<><div className="cloud-heading"><div><span className="cloud-tag">ACCOUNT & SECURITY</span><h1>Workspace settings</h1><p>Access and storage controls for your organization.</p></div></div>
             <section className="cloud-panel cloud-team"><h2>Your account</h2><p><strong>Authenticated email:</strong> {userEmail}</p><p><strong>Active organization:</strong> {org?.name}</p><p><strong>Access role:</strong> {org?.role}</p><p><strong>Release storage:</strong> Supabase PostgreSQL with RLS and immutable version snapshots</p><p><strong>Media:</strong> private bucket, scoped storage policies, temporary signed links</p><p><strong>Live publisher distribution:</strong> disabled pending security and permissions review</p><div className="studio-security-actions"><button className="cloud-button secondary" onClick={signOut} disabled={busy}>Sign out</button><button className="cloud-button secondary" onClick={signOutEverywhere} disabled={busy}>Sign out of all sessions</button></div><p>Global sign-out revokes refresh tokens. Previously issued access tokens can remain valid until they expire.</p></section>
           </>}
         </>}
       </>}
     </div>
     <footer className="cloud-footer"><span>© {new Date().getUTCFullYear()} Pubbblic · a <a href="https://mahtco.com" target="_blank" rel="noopener noreferrer">Mahtco</a> company</span><span>Tenant-secured drafting · Distribution disabled</span></footer>
   </div>
 </div>;
}
