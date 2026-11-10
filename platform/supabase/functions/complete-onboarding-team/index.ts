// Complete Pubbblic onboarding's optional invitation-review step.
// Trusted service role writes only this user's review marker after Auth + org checks.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
const headers={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json",
  "Cache-Control":"no-store",
};
const respond=(body:Record<string,unknown>,status=200)=>
  new Response(JSON.stringify(body),{status,headers});
function key(name:string,fallback:string):string|undefined{
  try{
    const raw=Deno.env.get(name),json=raw?JSON.parse(raw):null;
    return json?.default||Deno.env.get(fallback)||undefined;
  }catch{return Deno.env.get(fallback)||undefined;}
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
  const url=Deno.env.get("SUPABASE_URL");
  const publishable=key("SUPABASE_PUBLISHABLE_KEYS","SUPABASE_ANON_KEY");
  const secret=key("SUPABASE_SECRET_KEYS","SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!publishable||!secret)return respond({error:"not_configured"},503);
  const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!jwt)return respond({error:"authentication_required"},401);
  const client=createClient(url,publishable,{
    auth:{autoRefreshToken:false,persistSession:false},
    global:{headers:{Authorization:"Bearer "+jwt}},
  });
  const {data:{user},error:identityError}=await client.auth.getUser(jwt);
  if(identityError||!user?.id||!user.email_confirmed_at)
    return respond({error:"verified_login_required"},401);

  const [step,membership]=await Promise.all([
    client.from("user_onboarding").select("password_set_at").eq("user_id",user.id).maybeSingle(),
    client.from("organization_memberships").select("organization_id").eq("user_id",user.id).limit(1)
  ]);
  if(step.error||!step.data)return respond({error:"onboarding_record_unavailable"},503);
  if(!step.data.password_set_at)return respond({error:"set_password_first"},403);
  if(membership.error)return respond({error:"membership_lookup_failed"},503);
  if(!membership.data?.length)return respond({error:"create_or_join_workspace_first"},403);

  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error:updateError}=await admin.from("user_onboarding")
    .update({invitations_reviewed_at:new Date().toISOString()})
    .eq("user_id",user.id).select("user_id").maybeSingle();
  if(updateError||!data)return respond({error:"step_update_failed"},503);
  return respond({invitations_reviewed:true});
});
