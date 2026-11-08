import { createHmac } from "node:crypto";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pubbblic.com";
export function unsubLink(id: string): string {
  const secret=process.env.UNSUBSCRIBE_SIGNING_SECRET;
  if (!secret) throw new Error("Missing unsubscribe signing secret");
  const sig=createHmac("sha256",secret).update(id).digest("hex");
  return SITE_URL + "/unsubscribe?id=" + encodeURIComponent(id) + "&sig=" + sig;
}
export function verifyUnsub(id: string, sig: string): boolean {
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const expected=createHmac("sha256",process.env.UNSUBSCRIBE_SIGNING_SECRET || "").update(id).digest("hex");
  const { timingSafeEqual }=require("node:crypto") as typeof import("node:crypto");
  return timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(sig,"hex")) && Boolean(process.env.UNSUBSCRIBE_SIGNING_SECRET);
}
const sequences=[
  {subject:"You're on the Pubbblic launch list",title:"You're on the list.",body:"Thanks for joining Pubbblic. We're building a simpler way to prepare press releases for different publisher requirements and understand where an announcement actually lands. We'll share useful PR guidance and real launch news—not an invented release date."},
  {subject:"The most important press release question",title:"Is it actually news?",body:"A stronger press release starts with something specific: what changed, who benefits, and what facts support the announcement. Begin with a direct headline and an opening paragraph that answers the reader's most important questions. Here's a guide to help."},
  {subject:"One story, many editorial formats",title:"Your facts stay put.",body:"Different publishers often expect different headlines, lengths and formats. Pubbblic is being built to create publisher-specific versions from one approved release, while checking that quotes, dates, names and claims stay accurate."},
  {subject:"What a distribution report should really prove",title:"Submission is not publication.",body:"A form confirmation shows that a release was submitted, not that it appeared on a live publication. We're designing Pubbblic to distinguish publisher reviews, accepted content and independently verifiable live URLs."},
  {subject:"A little progress from Pubbblic",title:"We're still building.",body:"Our focus is on publisher eligibility, careful editorial adaptation and clearer outcome reporting. Pubbblic is still in development; we'll share launch access details when we can verify the product is ready."}
];
export function renderEmail(id: string, step: number) {
  const entry=step<sequences.length?sequences[step]:{subject:"Pubbblic build update",title:"A note from Pubbblic.",body:"We're continuing work on Pubbblic's release preparation, publisher permissions and reporting workflow. We haven't opened distribution to the public yet. Thanks for following along."};
  const url=unsubLink(id);
  const guide=SITE_URL+(step===1?"/guides/how-to-write-a-press-release":step===2?"/features/ai-rewriting":"/how-it-works");
  const html='<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;color:#1b2440;padding:30px"><div style="font-size:28px;font-weight:bold;color:#204ce5">pubbblic.</div><h1 style="font-size:29px;letter-spacing:-1px;margin-top:36px">'+entry.title+'</h1><p style="font-size:16px;line-height:1.8;color:#4e5b71">'+entry.body+'</p><p style="margin:35px 0"><a style="background:#244de2;color:#fff;text-decoration:none;padding:14px 19px;border-radius:8px;display:inline-block" href="'+guide+'">Explore Pubbblic</a></p><p style="border-top:1px solid #e7eaf1;padding-top:25px;color:#838b9e;font-size:12px;line-height:1.8">You joined the Pubbblic launch waitlist and opted in to educational and product update emails. <a href="'+url+'">Unsubscribe</a> anytime.<br/>Pubbblic · prelaunch announcements</p></div>';
  const text=entry.title+"\n\n"+entry.body+"\n\nExplore: "+guide+"\n\nYou subscribed to Pubbblic launch updates. Unsubscribe: "+url;
  return {subject:entry.subject,html,text};
}
