"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownTrayIcon, ArrowLeftIcon, ArrowRightIcon, ArrowTopRightOnSquareIcon,
  Bars3Icon, CheckCircleIcon, CheckBadgeIcon, ChevronRightIcon, ClockIcon,
  Cog6ToothIcon, DocumentDuplicateIcon, DocumentTextIcon, ExclamationCircleIcon,
  EyeIcon, GlobeAltIcon, HomeIcon, InformationCircleIcon, PencilSquareIcon,
  PlusIcon, ShieldCheckIcon, SparklesIcon, TrashIcon, XMarkIcon
} from "@heroicons/react/24/outline";
import {
  BLANK_DRAFT, DRAFTS_KEY, SAMPLE_DRAFT, createDraft, isReleaseDraft,
  type ReleaseDraft, type ReleaseCategory, validateDraft, wordCount
} from "@/lib/release";

type View = "overview" | "releases" | "studio" | "publishers" | "reports" | "settings";
const categories: ReleaseCategory[] = [
  "Product launch", "Company news", "Partnership", "Milestone", "Event", "Other"
];

function Logo() {
  return <div className="brand"><span className="brand-mark"><b/><b/><b/></span><strong>pubbblic<span>.</span></strong><small>STUDIO</small></div>;
}
const navItems: { value: View; label: string; icon: typeof HomeIcon }[] = [
  {value:"overview",label:"Overview",icon:HomeIcon},
  {value:"releases",label:"Press releases",icon:DocumentTextIcon},
  {value:"studio",label:"Release Studio",icon:PencilSquareIcon},
  {value:"publishers",label:"Publisher network",icon:GlobeAltIcon},
  {value:"reports",label:"Distribution reports",icon:DocumentDuplicateIcon},
  {value:"settings",label:"Workspace settings",icon:Cog6ToothIcon}
];
function SectionTitle({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action?:React.ReactNode}) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="page-action">{action}</div>}</div>;
}
function StatusPill({children,tone="neutral"}:{children:React.ReactNode;tone?:"neutral"|"blue"|"green"|"amber"}) {
  return <span className={"status-pill "+tone}>{children}</span>;
}
function EmptyState({icon:Icon,title,text,action}:{icon:typeof DocumentTextIcon;title:string;text:string;action?:React.ReactNode}) {
  return <div className="empty-state"><div className="empty-icon"><Icon width={28}/></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}
function Stat({label,value,note,icon:Icon}:{label:string;value:string;note:string;icon:typeof HomeIcon}) {
  return <div className="stat"><div className="stat-top"><span>{label}</span><Icon width={22}/></div><strong>{value}</strong><small>{note}</small></div>;
}
export function StudioApp(){
  const [view,setView]=useState<View>("overview");
  const [mobileOpen,setMobileOpen]=useState(false);
  const [drafts,setDrafts]=useState<ReleaseDraft[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [editing,setEditing]=useState<ReleaseDraft>({...SAMPLE_DRAFT});
  const [savedMessage,setSavedMessage]=useState("");
  const [showPreview,setShowPreview]=useState(true);
  useEffect(()=>{
    try{
      const raw=localStorage.getItem(DRAFTS_KEY);
      const parsed=raw?JSON.parse(raw):[];
      if(Array.isArray(parsed))setDrafts(parsed.filter(isReleaseDraft).slice(0,100));
    }catch{}
    setLoaded(true);
  },[]);
  const validation=useMemo(()=>validateDraft(editing),[editing]);
  const complete=validation.filter(x=>x.valid).length;
  const ready=complete===validation.length;
  const hasDrafts=drafts.length>0;
  const showNotice=()=>{setSavedMessage("");};
  function navigate(next:View){setView(next);setMobileOpen(false);setSavedMessage("");window.scrollTo({top:0,behavior:"smooth"});}
  function newRelease(){setEditing(createDraft());setShowPreview(true);navigate("studio");}
  function editRelease(d:ReleaseDraft){setEditing({...d});setShowPreview(true);navigate("studio");}
  function setField<K extends keyof ReleaseDraft>(key:K,value:ReleaseDraft[K]){
    setEditing(prev=>({...prev,[key]:value}));setSavedMessage("");
  }
  function save(){
    const now=new Date().toISOString();
    const next={...editing,updatedAt:now};
    const updated=[next,...drafts.filter(d=>d.id!==next.id)].slice(0,100);
    try{
      localStorage.setItem(DRAFTS_KEY,JSON.stringify(updated));
      setDrafts(updated);setEditing(next);
      setSavedMessage("Draft saved to this browser. It has not been submitted or shared.");
    }catch{setSavedMessage("Couldn't save this draft. Browser storage may be blocked or full.");}
  }
  function removeDraft(id:string){
    if(!window.confirm("Remove this draft from this browser? This cannot be undone."))return;
    const updated=drafts.filter(d=>d.id!==id);
    try{localStorage.setItem(DRAFTS_KEY,JSON.stringify(updated));setDrafts(updated);}catch{}
  }
  function exportDraft(){
    const text=JSON.stringify({...editing,validation:validateDraft(editing)},null,2);
    const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="pubbblic-release-"+editing.id.slice(0,8)+".json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  function clearSaved(){
    if(!window.confirm("Delete all locally saved draft releases from this browser?"))return;
    try{localStorage.removeItem(DRAFTS_KEY);setDrafts([]);setSavedMessage("Saved drafts cleared.");}catch{}
  }

  return <div className="app-shell">
    <aside className={"sidebar "+(mobileOpen?"open":"")}>
      <div className="sidebar-head"><Logo/><button className="sidebar-close" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"><XMarkIcon width={22}/></button></div>
      <div className="sidebar-group">
        <div className="sidebar-caption">WORKSPACE</div>
        <nav aria-label="Studio navigation">{navItems.map(item=><button type="button" className={"nav-button "+(view===item.value?"active":"")} key={item.value} onClick={()=>navigate(item.value)}><item.icon width={19}/><span>{item.label}</span>{item.value==="releases"&&drafts.length>0&&<small>{drafts.length}</small>}</button>)}</nav>
      </div>
      <div className="sidebar-bottom"><div className="sidebar-mini"><span className="mini-indicator"/><div><strong>Product preview</strong><small>External publishing disabled</small></div></div><a href="https://pubbblic.com" target="_blank" rel="noopener noreferrer" className="sidebar-external">Pubbblic website <ArrowTopRightOnSquareIcon width={16}/></a></div>
    </aside>
    {mobileOpen&&<button className="mobile-overlay" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>}
    <div className="main-wrap">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Bars3Icon width={23}/></button><span>Workspace</span><ChevronRightIcon width={14}/><strong>{navItems.find(x=>x.value===view)?.label}</strong></div><div className="topbar-right"><span className="top-pill"><span/> PRELAUNCH BUILD</span><button className="topbar-new" onClick={newRelease}><PlusIcon width={18}/> New release</button></div></header>
      <div className="body-area">
        <div className="preview-banner"><InformationCircleIcon width={19}/><span><strong>Interactive preview:</strong> Local drafts only. No accounts, cloud storage, payments, AI generation or publisher submissions are enabled. Avoid confidential releases.</span><button onClick={()=>navigate("settings")}>Learn more <ArrowRightIcon width={15}/></button></div>
        {view==="overview"&&<>
          <SectionTitle eyebrow="YOUR WORKSPACE" title="A clearer way to tell your story." subtitle="Bring announcements together, prepare the facts and see what comes next." action={<button className="btn primary" onClick={newRelease}><PlusIcon width={18}/> Create press release</button>}/>
          <div className="stats-grid">
            <Stat label="Saved drafts" value={String(drafts.length)} note="Stored on this device" icon={DocumentTextIcon}/>
            <Stat label="Live publications" value="0" note="Publishing not enabled" icon={GlobeAltIcon}/>
            <Stat label="Publisher connections" value="0" note="Pubbblic-managed (planned)" icon={ShieldCheckIcon}/>
            <Stat label="Campaigns" value="0" note="Distribution coming later" icon={ClockIcon}/>
          </div>
          <div className="dashboard-grid">
            <div className="panel welcome-panel"><span className="eyebrow blue-eyebrow">GET STARTED</span><h2>Your next announcement starts here<span>.</span></h2><p>Build a press release with the elements publishers expect. Review a live formatted preview, check for missing information, and save a draft on your device.</p><div className="welcome-actions"><button className="btn primary" onClick={newRelease}>Write a release <ArrowRightIcon width={17}/></button><button className="link-button" onClick={()=>editRelease(SAMPLE_DRAFT)}>Explore sample <ArrowRightIcon width={16}/></button></div><span className="welcome-deco"><DocumentTextIcon width={92}/></span></div>
            <div className="panel steps-panel"><span className="eyebrow">RELEASE CHECKLIST</span><h3>How Pubbblic will work</h3><div className="checklist-row"><span className="check-number">01</span><div><strong>Write & review</strong><p>Prepare your verified master release.</p></div><CheckCircleIcon width={18} className="check-done"/></div><div className="checklist-row"><span className="check-number">02</span><div><strong>Adapt for publishers</strong><p>DeepSeek variants with factual validation.</p></div><StatusPill>Planned</StatusPill></div><div className="checklist-row"><span className="check-number">03</span><div><strong>Publish & verify</strong><p>Use approved Pubbblic-owned accounts.</p></div><StatusPill>Planned</StatusPill></div></div>
          </div>
          <div className="panel recent-panel"><div className="panel-heading"><div><h3>Recent drafts</h3><p>Your work on this browser</p></div><button className="link-button" onClick={()=>navigate("releases")}>View drafts <ArrowRightIcon width={17}/></button></div>
            {hasDrafts? <div className="recent-list">{drafts.slice(0,3).map(d=><button key={d.id} className="recent-row" onClick={()=>editRelease(d)}><span className="release-icon"><DocumentTextIcon width={20}/></span><div><strong>{d.headline||"Untitled release"}</strong><small>{d.organization||"Organization not set"} · {new Date(d.updatedAt).toLocaleDateString()}</small></div><StatusPill tone="amber">Draft</StatusPill><ChevronRightIcon width={18}/></button>)}</div>:
            <EmptyState icon={DocumentTextIcon} title="No saved drafts yet" text="Create a new release or open the sample announcement to explore the editor." action={<button className="btn ghost" onClick={()=>editRelease(SAMPLE_DRAFT)}>Open sample release <ArrowRightIcon width={16}/></button>}/>}
          </div>
        </>}
        {view==="releases"&&<>
          <SectionTitle eyebrow="RELEASE LIBRARY" title="Your press releases" subtitle="Manage draft announcements stored locally in this browser." action={<button className="btn primary" onClick={newRelease}><PlusIcon width={18}/> New release</button>}/>
          <div className="panel library-panel"><div className="panel-heading"><div><h3>Saved drafts</h3><p>{loaded?drafts.length+" saved on this device":"Loading drafts"}</p></div><StatusPill>Local storage</StatusPill></div>
            {hasDrafts?<div className="release-list">{drafts.map(d=><div className="release-row" key={d.id}><div className="release-icon"><DocumentTextIcon width={22}/></div><div className="release-info"><strong>{d.headline||"Untitled release"}</strong><small>{d.organization||"Company not entered"} · {d.category} · Edited {new Date(d.updatedAt).toLocaleDateString()}</small></div><StatusPill tone="amber">Draft</StatusPill><button title="Edit" aria-label={"Edit "+(d.headline||"release")} className="icon-button" onClick={()=>editRelease(d)}><PencilSquareIcon width={19}/></button><button title="Delete" aria-label={"Delete "+(d.headline||"release")} className="icon-button danger" onClick={()=>removeDraft(d.id)}><TrashIcon width={19}/></button></div>)}</div>:
            <EmptyState icon={DocumentDuplicateIcon} title="Your release library is empty" text="Drafts appear here after you save them in Release Studio." action={<button className="btn primary" onClick={newRelease}>Create your first release <PlusIcon width={17}/></button>}/>}
          </div>
        </>}
        {view==="studio"&&<>
          <div className="studio-heading"><div><button className="back-button" onClick={()=>navigate("releases")}><ArrowLeftIcon width={17}/> All releases</button><span className="eyebrow">RELEASE STUDIO</span><h1>{editing.headline?"Prepare your announcement":"Write something newsworthy."}</h1><p>One approved source. Clear details. A live preview as you write.</p></div><div className="studio-actions"><button className="btn ghost" onClick={exportDraft}><ArrowDownTrayIcon width={18}/> Export JSON</button><button className="btn primary" onClick={save}><CheckCircleIcon width={18}/> Save draft</button></div></div>
          {savedMessage&&<div className="saved-message" role="status">{savedMessage}</div>}
          <div className="editor-grid">
            <div className="editor-main">
              <div className="editor-card"><div className="editor-card-head"><span className="step-bubble">01</span><div><h2>Story essentials</h2><p>The core of your announcement</p></div></div>
                <div className="field"><label htmlFor="release-headline">Headline <span>*</span></label><input id="release-headline" value={editing.headline} onChange={e=>setField("headline",e.target.value)} placeholder="Company announces what changed and why it matters" maxLength={140}/><div className="field-hint"><span>Be specific, factual and direct</span><span>{editing.headline.length}/140</span></div></div>
                <div className="field"><label htmlFor="release-summary">Summary <span>*</span></label><textarea id="release-summary" rows={3} value={editing.summary} onChange={e=>setField("summary",e.target.value)} placeholder="A concise overview of the announcement and why it's relevant." maxLength={320}/><div className="field-hint"><span>35–320 characters</span><span>{editing.summary.length}/320</span></div></div>
                <div className="field-row"><div className="field"><label htmlFor="issuer">Organization <span>*</span></label><input id="issuer" value={editing.organization} onChange={e=>setField("organization",e.target.value)} placeholder="Company or issuer"/></div><div className="field"><label htmlFor="category">Announcement type</label><select id="category" value={editing.category} onChange={e=>setField("category",e.target.value as ReleaseCategory)}>{categories.map(x=><option value={x} key={x}>{x}</option>)}</select></div></div>
                <div className="field"><label htmlFor="dateline">Dateline <span>*</span></label><input id="dateline" value={editing.dateline} onChange={e=>setField("dateline",e.target.value)} placeholder="AUSTIN, Texas — November 8, 2026"/><div className="field-hint">Use a location and confirmed public announcement date.</div></div>
              </div>
              <div className="editor-card"><div className="editor-card-head"><span className="step-bubble">02</span><div><h2>Full announcement</h2><p>Add the details that make the story meaningful</p></div></div>
                <div className="field"><label htmlFor="body">Press release body <span>*</span></label><textarea className="body-textarea" id="body" rows={11} value={editing.body} onChange={e=>setField("body",e.target.value)} placeholder="Lead with the news. Add context, supporting details and what comes next. Separate paragraphs with a blank line."/><div className="field-hint"><span>At least 60 words recommended for this demo checklist</span><span>{wordCount(editing.body)} words</span></div></div>
                <div className="field"><label htmlFor="quote">Approved quote <span className="optional">(optional)</span></label><textarea id="quote" rows={3} value={editing.quote} onChange={e=>setField("quote",e.target.value)} placeholder="A quote that adds credible context, not promotional filler."/></div>
                <div className="field"><label htmlFor="attribution">Quote attribution</label><input id="attribution" value={editing.quoteAttribution} onChange={e=>setField("quoteAttribution",e.target.value)} placeholder="Name, title and organization"/></div>
                <div className="field"><label htmlFor="boilerplate">Company boilerplate</label><textarea id="boilerplate" rows={3} value={editing.boilerplate} onChange={e=>setField("boilerplate",e.target.value)} placeholder="A short description of the organization and what it does."/></div>
              </div>
              <div className="editor-card"><div className="editor-card-head"><span className="step-bubble">03</span><div><h2>Media contact</h2><p>Help publishers verify the announcement</p></div></div><div className="field-row"><div className="field"><label htmlFor="contact-name">Contact name <span>*</span></label><input id="contact-name" value={editing.contactName} onChange={e=>setField("contactName",e.target.value)} placeholder="Media contact"/></div><div className="field"><label htmlFor="contact-email">Contact email <span>*</span></label><input id="contact-email" type="email" value={editing.contactEmail} onChange={e=>setField("contactEmail",e.target.value)} placeholder="press@company.com"/></div></div></div>
              <div className="editor-bottom"><button className="btn ghost" onClick={()=>editRelease(SAMPLE_DRAFT)}>Restore sample</button><button className="btn primary" onClick={save}>Save local draft <ArrowRightIcon width={18}/></button></div>
            </div>
            <aside className="editor-aside"><div className="validation-card"><div className="validation-header"><div><span className="eyebrow">EDITORIAL CHECKLIST</span><h3>Release readiness</h3></div><span className="readiness">{complete}/{validation.length}</span></div><div className="progress-rail"><div style={{width:Math.round(complete/validation.length*100)+"%"}}/></div><ul>{validation.map(v=><li key={v.label}><span className={v.valid?"valid":"invalid"}>{v.valid?<CheckCircleIcon width={18}/>:<ExclamationCircleIcon width={18}/>}</span><div><strong>{v.label}</strong><small>{v.detail}</small></div></li>)}</ul><div className={"ready-notice "+(ready?"passed":"")}><ShieldCheckIcon width={19}/><span>{ready?"All demo checks passed. This is not publisher approval.":"Complete the fields to pass the demo readiness checks."}</span></div></div>
              <div className="preview-card"><div className="preview-card-top"><div><EyeIcon width={19}/><strong>Live preview</strong></div><button onClick={()=>setShowPreview(x=>!x)} aria-expanded={showPreview}>{showPreview?"Hide":"Show"}</button></div>{showPreview&&<div className="release-preview"><span className="preview-tag">DRAFT · NOT PUBLISHED</span><h3>{editing.headline||"Your headline will appear here"}</h3><p className="preview-summary">{editing.summary||"The summary will introduce the announcement."}</p><div className="preview-dateline">{editing.dateline||"CITY — DATE"}</div>{editing.body.trim()?editing.body.split(/\n\s*\n/).filter(Boolean).map((p,i)=><p key={i}>{p}</p>):<p>Start writing the announcement to preview it here.</p>}{editing.quote&&<blockquote>“{editing.quote}”{editing.quoteAttribution&&<cite> — {editing.quoteAttribution}</cite>}</blockquote>}{editing.boilerplate&&<div className="preview-boilerplate"><strong>About {editing.organization||"the company"}</strong><p>{editing.boilerplate}</p></div>}<div className="preview-contact"><strong>Media contact</strong><p>{editing.contactName||"Not entered"}<br/>{editing.contactEmail||"No email entered"}</p></div></div>}</div>
            </aside>
          </div>
        </>}
        {view==="publishers"&&<>
          <SectionTitle eyebrow="PUBLISHER NETWORK" title="Prepare for the right destinations." subtitle="Pubbblic will manage authorized publisher accounts and editorial requirements. No customer account connections."/>
          <div className="panel network-intro"><div className="network-symbol"><GlobeAltIcon width={45}/></div><div><StatusPill tone="amber">Not yet enabled</StatusPill><h2>Publisher access is being validated.</h2><p>We won't imply a publisher relationship before authorization is verified. Pubbblic's planned connector routes are official publisher APIs, approved Zyte Actions workflows, or internal operator-assisted submissions using Pubbblic's own accounts.</p></div></div>
          <div className="capability-grid">{[{icon:ShieldCheckIcon,title:"Authorized access",text:"Destination permissions and account standing are reviewed before activation."},{icon:SparklesIcon,title:"Publisher-specific copy",text:"Each selected destination will receive a distinct, fact-checked DeepSeek variant."},{icon:GlobeAltIcon,title:"Verified placement",text:"Submission, review and published status are recorded separately."}].map(x=><div className="panel capability" key={x.title}><x.icon width={26}/><h3>{x.title}</h3><p>{x.text}</p></div>)}</div>
        </>}
        {view==="reports"&&<>
          <SectionTitle eyebrow="DISTRIBUTION INTELLIGENCE" title="Clarity after every submission." subtitle="Verified destinations and receipts will appear here when publisher distribution becomes available."/>
          <div className="stats-grid"><Stat label="Dispatched" value="0" note="No live submissions" icon={ArrowRightIcon}/><Stat label="Under review" value="0" note="No live publisher workflows" icon={ClockIcon}/><Stat label="Verified published" value="0" note="No confirmed URLs" icon={CheckBadgeIcon}/><Stat label="Active destinations" value="0" note="Requires publisher permissions" icon={GlobeAltIcon}/></div>
          <div className="panel"><EmptyState icon={DocumentDuplicateIcon} title="No distribution reports yet" text="This is an interactive prelaunch editor. Reports will become available only after authorized submissions and independent publication verification."/></div>
        </>}
        {view==="settings"&&<>
          <SectionTitle eyebrow="WORKSPACE SETTINGS" title="Built carefully, from the start." subtitle="This early product preview is intentionally limited to safe local drafting and editing."/>
          <div className="settings-grid"><div className="panel settings-panel"><h2>Preview environment</h2><div className="setting-line"><span>Sign-up and authentication</span><StatusPill tone="amber">Not connected</StatusPill></div><div className="setting-line"><span>Cloud draft storage</span><StatusPill tone="amber">Not connected</StatusPill></div><div className="setting-line"><span>DeepSeek rewriting</span><StatusPill tone="amber">Not connected</StatusPill></div><div className="setting-line"><span>Zyte and publisher accounts</span><StatusPill tone="amber">Disabled</StatusPill></div><div className="setting-line"><span>Payments</span><StatusPill tone="amber">Disabled</StatusPill></div></div><div className="panel settings-panel"><h2>Browser draft storage</h2><p>Drafts are saved only when you click Save. They remain in this browser's local storage and are not uploaded to a Pubbblic server. Browser storage can be cleared or lost. Don't enter confidential customer releases.</p><p><strong>{drafts.length} draft{drafts.length===1?"":"s"}</strong> currently saved in this browser.</p><button className="btn danger-outline" onClick={clearSaved}><TrashIcon width={18}/> Delete locally saved drafts</button>{savedMessage&&<div className="saved-message" role="status">{savedMessage}</div>}</div></div>
          <div className="panel compliance-panel"><InformationCircleIcon width={24}/><div><strong>Next production requirements</strong><p>Before customer use: Supabase project and RLS, verified email authentication, secure drafts/media storage, editorial roles, DeepSeek validation pipeline, authorized publisher access, queue idempotency, compliance review, payment gates and end-to-end testing.</p></div></div>
        </>}
      </div>
      <footer className="app-footer"><span>© {new Date().getUTCFullYear()} Pubbblic · a <a href="https://mahtco.com" target="_blank" rel="noopener noreferrer">Mahtco</a> company</span><span>Preview only · Nothing is published</span></footer>
    </div>
  </div>;
}
