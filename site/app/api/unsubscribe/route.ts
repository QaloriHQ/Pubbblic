import { NextRequest,NextResponse } from "next/server";
import { verifyUnsub } from "@/lib/email";
import { adminRequest } from "@/lib/supabase-admin";
export async function POST(req:NextRequest){
  const data=await req.formData();
  const id=String(data.get("id")||"");
  const sig=String(data.get("sig")||"");
  if(!verifyUnsub(id,sig))return new NextResponse("Invalid unsubscribe link",{status:400});
  try{
    await adminRequest("marketing_waitlist?id=eq."+id,"PATCH",{subscribed:false,claim_until:null,next_email_at:null,unsubscribed_at:new Date().toISOString()});
    return NextResponse.redirect(new URL("/unsubscribed",req.url),303);
  }catch{return new NextResponse("Unsubscribe could not be completed. Please try again.",{status:503});}
}
