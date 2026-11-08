import { NextRequest, NextResponse } from "next/server";
import { adminRequest,isStorageConfigured } from "@/lib/supabase-admin";
import { renderEmail } from "@/lib/email";
import { createHmac } from "node:crypto";
export const runtime="nodejs";
export const maxDuration=60;
type Subscriber={id:string;email:string;email_step:number;subscribed:boolean};
export async function GET(req:NextRequest) {
  const secret=process.env.CRON_SECRET;
  if(!secret || req.headers.get("authorization")!=="Bearer "+secret) return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!isStorageConfigured() || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM || !process.env.UNSUBSCRIBE_SIGNING_SECRET || !process.env.EMAIL_POSTAL_ADDRESS)
    return NextResponse.json({error:"Email provider or storage not configured"},{status:503});
  if(process.env.WAITLIST_LAUNCHED==="true")return NextResponse.json({status:"paused_for_launch"});
  let sent=0,failed=0;
  try {
    const claimed=await adminRequest("rpc/claim_marketing_waitlist_batch","POST",{p_limit:10}) as Subscriber[];
    for(const person of claimed){
      if(!person.subscribed)continue;
      const {subject,html,text}=renderEmail(person.id,person.email_step);
      try {
        const res=await fetch("https://api.resend.com/emails",{
          method:"POST",headers:{"Authorization":"Bearer "+process.env.RESEND_API_KEY,
          "Content-Type":"application/json","Idempotency-Key":"pubbblic-waitlist-"+person.id+"-"+person.email_step},
          body:JSON.stringify({from:process.env.RESEND_FROM,to:[person.email],subject,html,text,
            headers:{"List-Unsubscribe":"<"+(process.env.NEXT_PUBLIC_SITE_URL || "https://pubbblic.com")+"/unsubscribe?id="+person.id+"&sig="+createHmac("sha256",process.env.UNSUBSCRIBE_SIGNING_SECRET).update(person.id).digest("hex")+">"}}),
          signal:AbortSignal.timeout(15000)
        });
        if(!res.ok) throw new Error("Email provider returned "+res.status);
        const step=person.email_step+1;
        const days=step===1?3:step===2?4:step===3?7:step===4?14:30;
        await adminRequest("marketing_waitlist?id=eq."+person.id,"PATCH",{email_step:step,next_email_at:new Date(Date.now()+days*86400000).toISOString(),claim_until:null,last_email_at:new Date().toISOString(),email_error:null});
        sent++;
      }catch(err){
        failed++;
        await adminRequest("marketing_waitlist?id=eq."+person.id,"PATCH",{claim_until:null,next_email_at:new Date(Date.now()+3600000).toISOString(),email_error:err instanceof Error?err.message.slice(0,180):"send failed"}).catch(()=>{});
      }
    }
    return NextResponse.json({sent,failed,processed:claimed.length});
  }catch{
    return NextResponse.json({error:"Drip processing unavailable"},{status:503});
  }
}
