import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/browser";
import { CloudWorkspace } from "@/components/CloudWorkspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace | Pubbblic", robots: { index: false, follow: false } };
export default async function Dashboard({searchParams}:{searchParams:Promise<{organization?:string}>}) {
  if(!isSupabaseConfigured()) redirect("/login?error=not_configured");
  const supabase = await createClient();
  const { data, error }=await supabase.auth.getClaims();
  const uid=data?.claims?.sub;
  if(error || !uid) redirect("/login");
  const email=typeof data?.claims?.email==="string"?data.claims.email:"";
  const {organization=""}=await searchParams;
  const initialOrgId=/^[0-9a-f-]{36}$/i.test(organization)?organization:"";
  return <CloudWorkspace userId={uid} userEmail={email} initialOrgId={initialOrgId}/>;
}
