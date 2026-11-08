import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    status: "ok",
    product: "pubbblic-studio",
    mode: "product-preview",
    publishingEnabled: false,
    backendConnected: false
  }, { headers: { "Cache-Control": "no-store" } });
}
