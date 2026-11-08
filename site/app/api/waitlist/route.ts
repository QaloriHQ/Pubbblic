import { NextRequest, NextResponse } from "next/server";
import { adminRequest, isStorageConfigured } from "@/lib/supabase-admin";
export const runtime="nodejs";
export async function POST(req:NextRequest){
  if (!isStorageConfigured()) return NextResponse.json({message:"Waitlist registration is not available yet. Please check back shortly."},{status:503});
  const origin=req.headers.get("origin");
  if(origin && origin!==req.nextUrl.origin) return NextResponse.json({message:"Invalid origin"},{status:403});
  let data:Record<string,unknown>;
  try {data=await req.json();} catch{return NextResponse.json({message:"Invalid request"},{status:400});}
  if(data.companyWebsite) return NextResponse.json({message:"You're on the list."});
  const email=typeof data.email==="string"?data.email.trim().toLowerCase():"";
  const audience=typeof data.audience==="string"?data.audience:"";
  const consent=data.consent===true;
  const source=typeof data.source==="string"?data.source.slice(0,120):"site";
  if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["business","startup","agency","other"].includes(audience) || !consent)
    return NextResponse.json({message:"Enter a valid email and confirm that you want launch updates."},{status:400});
  try{
    await adminRequest("marketing_waitlist?on_conflict=email","POST",{
      email,audience,source,consent_at:new Date().toISOString(),consent_version:"2026-11",
      next_email_at:new Date().toISOString(),email_step:0,subscribed:true
    },{"Prefer":"resolution=ignore-duplicates,return=minimal"});
    return NextResponse.json({message:"Thanks for signing up. We'll share launch news and occasional useful PR guidance."},{status:201});
  }catch{
    return NextResponse.json({message:"Registration couldn't be saved. Please try again later."},{status:503});
  }
}
