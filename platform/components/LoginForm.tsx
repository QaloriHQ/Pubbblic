"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon, EnvelopeIcon, LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/browser";

export function LoginForm() {
  const router=useRouter();
  const search=useSearchParams();
  const [email,setEmail]=useState("");
  const [otp,setOtp]=useState("");
  const [phase,setPhase]=useState<"email"|"code">("email");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [failure,setFailure]=useState("");
  const configured=isSupabaseConfigured();
  const initialError=search.get("error");
  async function sendCode(e: React.FormEvent) {
    e.preventDefault();setBusy(true);setFailure("");setNotice("");
    try {
      const supabase=createClient();
      const {error}=await supabase.auth.signInWithOtp({
        email:email.trim().toLowerCase(),
        options:{shouldCreateUser:true,emailRedirectTo:window.location.origin+"/auth/callback"}
      });
      if(error) throw error;
      setPhase("code");
      setNotice("Check your inbox. Use the six-digit code if included, or follow the sign-in link. Codes require an OTP-enabled email template.");
    }catch(err){setFailure(err instanceof Error?err.message:"Could not send a sign-in email.");}
    finally{setBusy(false);}
  }
  async function verifyCode(e:React.FormEvent){
    e.preventDefault();setBusy(true);setFailure("");
    try {
      const supabase=createClient();
      const {error}=await supabase.auth.verifyOtp({email:email.trim().toLowerCase(),token:otp.trim(),type:"email"});
      if(error)throw error;
      router.replace("/dashboard");router.refresh();
    }catch(err){setFailure(err instanceof Error?err.message:"That code is invalid or expired.");}
    finally{setBusy(false);}
  }
  return <div className="auth-page"><div className="auth-left">
    <div className="auth-header"><Link href="https://pubbblic.com" className="auth-brand">pubbblic<span>.</span></Link><span>STUDIO</span></div>
    <div className="auth-wrap"><span className="auth-eyebrow"><ShieldCheckIcon width={17}/> SECURE WORKSPACE</span><h1>Welcome to<br/><em>Pubbblic.</em></h1><p>One approved release. Publisher-ready preparation. A clearer story of where your news lands.</p><div className="auth-features"><span><LockClosedIcon width={18}/> Email-based authentication</span><span><ShieldCheckIcon width={18}/> Organization-isolated releases</span></div></div>
    <small className="auth-copyright">© {new Date().getUTCFullYear()} Pubbblic · a <a href="https://mahtco.com" target="_blank" rel="noopener noreferrer">Mahtco</a> company</small>
  </div><div className="auth-right"><div className="auth-panel">
    <span className="auth-card-icon"><EnvelopeIcon width={23}/></span>
    <span className="eyebrow">PUBBBLIC ACCOUNT</span>
    <h2>{phase==="email"?"Sign in or create an account":"Check your email"}</h2>
    <p>Secure, passwordless access to your organization workspace.</p>
    {!configured ? <div className="auth-error">Authentication is not activated for this deployment. A dedicated Pubbblic Supabase project must be connected before accounts can be created.</div> : <>
      {initialError && <div className="auth-error">The sign-in link is unavailable or has expired. Request a new sign-in email.</div>}
      {phase==="email"?<form onSubmit={sendCode}>
        <label htmlFor="sign-in-email">Email address</label>
        <input id="sign-in-email" autoComplete="email" required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/>
        <button className="btn primary auth-submit" disabled={busy} type="submit">{busy?"Sending…":"Continue with email"}<ArrowRightIcon width={17}/></button>
      </form>:<form onSubmit={verifyCode}>
        <label htmlFor="otp-email">Email</label><input id="otp-email" type="email" value={email} readOnly/>
        <label htmlFor="otp-code">One-time code</label><input id="otp-code" value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="6-digit code" aria-describedby="otp-hint"/>
        <small id="otp-hint">If your email contains a sign-in link rather than a code, use that link.</small>
        <button type="submit" className="btn primary auth-submit" disabled={busy||otp.length!==6}>{busy?"Verifying…":"Verify code"}<ArrowRightIcon width={17}/></button>
        <button type="button" className="auth-back" onClick={()=>{setPhase("email");setOtp("");setFailure("");setNotice("");}}>Use another email</button>
      </form>}
      {notice&&<div className="auth-notice" role="status">{notice}</div>}
      {failure&&<div className="auth-error" role="alert">{failure}</div>}
    </>}
    <div className="auth-foot">Your publisher accounts are managed by Pubbblic. We never ask customers to connect third-party publisher credentials.</div>
    <div className="auth-links"><Link href="/preview">Explore a local-only demo</Link><a href="https://pubbblic.com" target="_blank" rel="noopener noreferrer">Pubbblic.com</a></div>
  </div></div></div>;
}
