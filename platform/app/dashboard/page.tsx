import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/browser";
import { CloudWorkspace } from "@/components/CloudWorkspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace | Pubbblic", robots: { index: false, follow: false } };
export default async function Dashboard({searchParams}:{searchParams:Promise<{organization?:string;start?:string}>}) {
  if(!isSupabaseConfigured()) redirect("/login?error=not_configured");
  const supabase = await createClient();
  const { data, error }=await supabase.auth.getClaims();
  const uid=data?.claims?.sub;
  if(error || !uid) redirect("/login");
  const email=typeof data?.claims?.email==="string"?data.claims.email:"";
  const {data:onboarding,error:onboardingError}=await supabase.from("user_onboarding")
    .select("password_set_at,invitations_reviewed_at").eq("user_id",uid).maybeSingle();
  if(onboardingError||!onboarding||!onboarding.password_set_at) redirect("/onboarding");
  const {data:members,error:membersError}=await supabase.from("organization_memberships")
    .select("organization_id").eq("user_id",uid).limit(1);
  if(membersError||!members?.length||!onboarding.invitations_reviewed_at) redirect("/onboarding");
  const {organization="",start=""}=await searchParams;
  const initialOrgId=/^[0-9a-f-]{36}$/i.test(organization)?organization:"";
  return <CloudWorkspace userId={uid} userEmail={email} initialOrgId={initialOrgId}
    initialTab={start==="editor"?"editor":"home"}/>;
}
