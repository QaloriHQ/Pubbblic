import { InvitationJoin } from "@/components/InvitationJoin";
export const dynamic = "force-dynamic";
export const metadata = { title: "Join an organization | Pubbblic", robots: { index:false, follow:false } };
export default async function InvitationPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return <InvitationJoin invitationId={id}/>;
}
