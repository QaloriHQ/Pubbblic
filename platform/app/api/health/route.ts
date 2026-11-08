import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/browser";
export async function GET() {
  return NextResponse.json({
    status: "ok",
    product: "pubbblic-workspaces",
    authConfigured: isSupabaseConfigured(),
    publishingEnabled: false,
    billingEnabled: false
  }, { headers: { "Cache-Control": "no-store" } });
}
