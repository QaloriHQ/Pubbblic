"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, CheckCircleIcon, EnvelopeIcon, LockClosedIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/lib/supabase/browser";

type Invitation = { invitation_id: string; organization_name: string; invited_role: string; expires_at: string };
const configuredLength = Number(process.env.NEXT_PUBLIC_EMAIL_OTP_LENGTH ?? "8");
const otpLength = Number.isInteger(configuredLength) && configuredLength >= 6 && configuredLength <= 10 ? configuredLength : 8;
const invitationFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function InvitationJoin({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email,setEmail]=useState("");
  const [code,setCode]=useState("");
  const [signedInEmail,setSignedInEmail]=useState<string | null>(null);
  const [invite,setInvite]=useState<Invitation|null>(null);
  const [checking,setChecking]=useState(true);
  const [sending,setSending]=useState(false);
  const [verifying,setVerifying]=useState(false);
  const [accepting,setAccepting]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const loadInvitation = useCallback(async () => {
    setChecking(true);setError("");
    try {
      const {data:{user},error:e}=await supabase.auth.getUser();
      if(e||!user?.email||!user.email_confirmed_at){
        setSignedInEmail(null);setInvite(null);return;
      }
      setSignedInEmail(user.email);
      const {data,error:invErr}=await supabase.rpc("my_organization_invitations");
      if(invErr)throw invErr;
      const match=((data||[]) as Invitation[]).find(i=>i.invitation_id===invitationId);
      setInvite(match||null);
    } catch(err){
      setError(err instanceof Error?err.message:"Could not load this invitation.");
    } finally {setChecking(false);}
  },[invitationId,supabase]);

  useEffect(()=>{void loadInvitation();},[loadInvitation]);
  async function sendCode(e:React.FormEvent){
    e.preventDefault();setError("");setNotice("");setSending(true);
    try{
      const {error:e}=await supabase.auth.signInWithOtp({
        email:email.trim().toLowerCase(),
        options:{shouldCreateUser:true,emailRedirectTo:window.location.origin+"/invite/"+invitationId}
      });
      if(e)throw e;
      setSent(true);
      setNotice("Verification email requested. Enter the complete code to view and accept your invitation.");
    }catch(e){setError(e instanceof Error?e.message:"Could not request a sign-in code.");}
    finally{setSending(false);}
  }
  async function verifyCode(e:React.FormEvent){
    e.preventDefault();setError("");setVerifying(true);
    try{
      const {error:e}=await supabase.auth.verifyOtp({email:email.trim().toLowerCase(),token:code,type:"email"});
      if(e)throw e;
      setNotice("Email verified. Checking your organization invitation…");
      await loadInvitation();
    }catch(e){setError(e instanceof Error?e.message:"Code invalid or expired.");}
    finally{setVerifying(false);}
  }
  async function switchAccount(){
    setError("");setNotice("");
    const {error:e}=await supabase.auth.signOut();
    if(e){setError(e.message);return;}
    setInvite(null);setSignedInEmail(null);setSent(false);setCode("");
    await loadInvitation();
  }
  async function accept(){
    if(!invite)return;
    setAccepting(true);setError("");setNotice("");
    try{
      const {data:organizationId,error:e}=await supabase.rpc("accept_organization_invitation",{p_invitation_id:invitationId});
      if(e)throw e;
      router.replace("/dashboard?organization="+encodeURIComponent(String(organizationId)));
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Could not accept this invitation.");}
    finally{setAccepting(false);}
  }
  const invalidId=!invitationFormat.test(invitationId);
  return <div className="invite-page">
    <header className="invite-top"><Link href="https://pubbblic.com" className="invite-brand">pubbblic<span>.</span></Link><span>STUDIO</span><Link href="/login" className="invite-login-link">Account sign-in</Link></header>
    <main className="invite-main">
      <div className="invite-icon"><UserGroupIcon width={25}/></div>
      <span className="cloud-tag">ORGANIZATION INVITATION</span>
      <h1>Join your Pubbblic workspace</h1>
      <p className="invite-lead">Accept a secure invitation to collaborate on press releases. Access is granted only after verifying the invited email address.</p>
      {invalidId ? <div className="auth-error" role="alert">This invitation link is invalid. Ask the organization administrator for a new link.</div> :
       checking?<div className="invite-notice">Checking your account and invitation…</div> :
       signedInEmail ? <>
        <div className="invite-identity"><CheckCircleIcon width={19}/><span>Signed in as <strong>{signedInEmail}</strong></span></div>
        {invite?<div className="invite-card">
          <span className="cloud-tag">YOU'VE BEEN INVITED</span>
          <h2>{invite.organization_name}</h2>
          <p>Invitation role: <strong>{invite.invited_role}</strong></p>
          <p>Expires: {new Date(invite.expires_at).toLocaleDateString()}</p>
          <button type="button" className="cloud-button invite-primary" onClick={accept} disabled={accepting}>{accepting?"Joining…":"Accept invitation and join"}<ArrowRightIcon width={18}/></button>
          <p className="invite-fine">Access begins only when you select Accept. You can decline by leaving this page.</p>
        </div>:<div className="invite-card">
          <h2>No matching invitation for this account</h2>
          <p>This invitation may belong to another email, have expired, or already been accepted.</p>
          <button type="button" className="cloud-button" onClick={switchAccount}>Use a different email</button>
          <Link href="/dashboard" className="invite-text-link">Go to workspace</Link>
        </div>}
       </>:<div className="invite-card">
          <h2>Verify your invited email</h2>
          <p>Whether you already have a Pubbblic account or you're joining for the first time, enter your invited email. Supabase will send a one-time verification code.</p>
          {!sent?<form onSubmit={sendCode}>
            <label htmlFor="invite-email">Invited email address</label>
            <input id="invite-email" type="email" required maxLength={254} autoComplete="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)}/>
            <button className="cloud-button invite-primary" type="submit" disabled={sending}>{sending?"Requesting code…":"Send verification code"}<ArrowRightIcon width={18}/></button>
          </form>:<form onSubmit={verifyCode}>
            <label htmlFor="invite-readonly-email">Email</label><input id="invite-readonly-email" value={email} readOnly/>
            <label htmlFor="invite-code">Verification code</label>
            <input id="invite-code" type="text" required inputMode="numeric" autoComplete="one-time-code" value={code}
             onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,otpLength))}
             minLength={otpLength} maxLength={otpLength} pattern={"[0-9]{"+otpLength+"}"} placeholder={otpLength+"-digit code"}/>
            <button className="cloud-button invite-primary" type="submit" disabled={verifying||code.length!==otpLength}>{verifying?"Verifying…":"Verify and view invitation"}<ArrowRightIcon width={18}/></button>
            <button className="invite-link-button" type="button" onClick={()=>{setSent(false);setCode("");setNotice("");setError("");}}>Use another email</button>
          </form>}
          <p className="invite-fine"><LockClosedIcon width={15}/> Organization access is restricted to the invited, verified email.</p>
        </div>}
      {notice&&<div className="auth-notice" role="status">{notice}</div>}
      {error&&<div className="auth-error" role="alert">{error}</div>}
    </main>
    <footer className="invite-footer"><EnvelopeIcon width={14}/> Pubbblic · a <a href="https://mahtco.com">Mahtco</a> company</footer>
  </div>;
}
