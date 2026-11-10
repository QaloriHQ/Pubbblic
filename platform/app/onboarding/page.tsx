import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/browser";
import { OnboardingWizard } from "@/components/OnboardingWizard";
export const dynamic="force-dynamic";
export const metadata={title:"Get started | Pubbblic Studio",robots:{index:false,follow:false}};
export default async function Onboarding({searchParams}:{
  searchParams:Promise<{invite?:string;organization?:string}>
}){
  if(!isSupabaseConfigured())redirect("/login?error=not_configured");
  const supabase=await createClient();
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user?.email||!user.email_confirmed_at)redirect("/login");
  const p=await searchParams;
  const valid=(id:string)=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)?id:"";
  return <OnboardingWizard userId={user.id} userEmail={user.email}
    preferredInviteId={valid(p.invite||"")} preferredOrgId={valid(p.organization||"")}/>;
}
