// Pubbblic first-login password setup. The password travels only in this
// authenticated HTTPS request; it is never returned, logged or stored by Pubbblic.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (body:Record<string,unknown>,status=200)=>
  new Response(JSON.stringify(body),{status,headers});
function envKey(variable:string,legacy:string):string|undefined{
  try{
    const raw=Deno.env.get(variable);
    const data=raw?JSON.parse(raw):null;
    return data?.default || Deno.env.get(legacy) || undefined;
  }catch{return Deno.env.get(legacy)||undefined;}
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
  const url=Deno.env.get("SUPABASE_URL");
  const pub=envKey("SUPABASE_PUBLISHABLE_KEYS","SUPABASE_ANON_KEY");
  const secret=envKey("SUPABASE_SECRET_KEYS","SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!pub||!secret)return reply({error:"not_configured"},503);
  const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!jwt)return reply({error:"authentication_required"},401);
  const requester=createClient(url,pub,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:"Bearer "+jwt}},
  });
  const {data:{user},error:identityError}=await requester.auth.getUser(jwt);
  if(identityError||!user?.id||!user.email_confirmed_at)
    return reply({error:"verified_login_required"},401);
  let password="";
  try{
    const data=await req.json();
    password=typeof data?.password==="string"?data.password:"";
  }catch{return reply({error:"invalid_json"},400);}
  if(password.length<12||password.length>128||
     !/[a-z]/.test(password)||!/[A-Z]/.test(password)||
     !/\d/.test(password))
    return reply({error:"password_policy",message:"Use 12–128 characters with uppercase, lowercase and a number."},400);

  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:row,error:readError}=await admin.from("user_onboarding")
    .select("user_id,password_set_at").eq("user_id",user.id).maybeSingle();
  if(readError||!row)return reply({error:"onboarding_record_missing"},503);
  if(row.password_set_at)return reply({error:"already_completed"},409);

  // Auth is the sole password store. Do not write plaintext credentials anywhere.
  const {error:passwordError}=await admin.auth.admin.updateUserById(user.id,{password});
  password="";
  if(passwordError)return reply({error:"password_rejected",message:"Please choose a stronger password."},400);

  const {data:updated,error:updateError}=await admin.from("user_onboarding")
    .update({password_set_at:new Date().toISOString()})
    .eq("user_id",user.id).is("password_set_at",null)
    .select("user_id").maybeSingle();
  if(updateError||!updated){
    console.error("Password updated but onboarding state could not be finalized",String(updateError?.code||"missing_row"));
    return reply({error:"state_update_failed",message:"Password set; contact support to complete onboarding."},503);
  }
  return reply({password_set:true});
});
