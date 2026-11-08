import type { Metadata } from "next";
export const metadata:Metadata={title:"Unsubscribe from launch updates",robots:{index:false}};
export default async function Unsubscribe({searchParams}:{searchParams:Promise<{id?:string;sig?:string}>}){
  const p=await searchParams;
  return <section className="section unsubscribe-section"><div className="container"><div className="unsubscribe-form"><span className="eyebrow">EMAIL PREFERENCES</span><h1>Leave the launch list</h1><p>We respect your inbox. Confirm below to stop Pubbblic prelaunch updates and educational emails.</p><form method="POST" action="/api/unsubscribe"><input type="hidden" name="id" value={p.id||""}/><input type="hidden" name="sig" value={p.sig||""}/><button className="button button-blue" type="submit">Unsubscribe me</button></form></div></div></section>;
}
