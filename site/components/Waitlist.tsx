"use client";
import { useState } from "react";
import { ArrowRightIcon, CheckCircleIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
export function WaitlistForm({ compact = false, source = "site" }: { compact?: boolean; source?: string }) {
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState("business");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle"|"success"|"error">("idle");
  const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setStatus("idle"); setMessage("");
    try {
      const result = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, audience, consent, companyWebsite: honeypot, source })
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(data.message || "We couldn't add you right now. Please try again.");
      setStatus("success"); setMessage(data.message || "You're on the list!"); setEmail("");
    } catch (err) {
      setStatus("error"); setMessage(err instanceof Error ? err.message : "Please try again.");
    } finally { setLoading(false); }
  }
  return <div className={"waitlist-card" + (compact ? " waitlist-compact" : "")}>
    {status === "success" ? <div className="waitlist-success" role="status"><CheckCircleIcon width={34}/><strong>You&apos;re on the list.</strong><p>{message}</p></div> : <>
      <div className="waitlist-form-head">{!compact && <span className="small-icon"><EnvelopeIcon width={20}/></span>}<div><span className="eyebrow eyebrow-blue">GET EARLY ACCESS</span><h3>Be first when Pubbblic launches.</h3><p>Get thoughtful launch updates, practical PR guides, and first access when distribution opens.</p></div></div>
      <form onSubmit={submit}>
        <label htmlFor={"wl-email-" + source}>Work email</label>
        <div className="email-line"><input id={"wl-email-" + source} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" maxLength={254} required/><button className="button button-blue" type="submit" disabled={loading}>{loading?"Joining...":"Join waitlist"}<ArrowRightIcon width={17}/></button></div>
        <label htmlFor={"wl-audience-" + source} className="label-spaced">I&apos;m interested as a</label>
        <select id={"wl-audience-" + source} value={audience} onChange={e=>setAudience(e.target.value)}><option value="business">Business or brand</option><option value="startup">Startup founder</option><option value="agency">PR or marketing agency</option><option value="other">Other</option></select>
        <div className="hidden-hp" aria-hidden="true"><label htmlFor={"wl-site-" + source}>Website</label><input id={"wl-site-" + source} tabIndex={-1} autoComplete="off" value={honeypot} onChange={e=>setHoneypot(e.target.value)}/></div>
        <label className="consent-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>I agree to receive Pubbblic launch updates and occasional PR education emails. I can unsubscribe anytime. See <a href="/privacy">Privacy</a>.</span></label>
        {status === "error" && <div className="form-error" role="alert">{message}</div>}
      </form>
      <div className="form-micro">Free to join · No credit card · No launch date promised</div>
    </>}
  </div>;
}
