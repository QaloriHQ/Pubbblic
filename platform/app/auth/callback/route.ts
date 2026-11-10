import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/browser";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (!isSupabaseConfigured()) return NextResponse.redirect(new URL("/login?error=not_configured",url.origin));
  const code=url.searchParams.get("code");
  const tokenHash=url.searchParams.get("token_hash");
  const type=url.searchParams.get("type");
  const supabase=await createClient();
  if(code) {
    const {error}=await supabase.auth.exchangeCodeForSession(code);
    if(!error) return NextResponse.redirect(new URL("/onboarding",url.origin));
  } else if(tokenHash && (type==="email"||type==="magiclink"||type==="signup"||type==="invite")) {
    const {error}=await supabase.auth.verifyOtp({ token_hash:tokenHash, type:type as "email"|"magiclink"|"signup"|"invite" });
    if(!error) return NextResponse.redirect(new URL("/onboarding",url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=expired_link",url.origin));
}
