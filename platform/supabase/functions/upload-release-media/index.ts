// Pubbblic G2 private media ingestion. Static signature screening is not antivirus scanning.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.119.0";
const maxBytes=10*1024*1024;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Content-Type":"application/json",
 "Cache-Control":"no-store"
};
const respond=(data:Record<string,unknown>,status=200)=>new Response(JSON.stringify(data),{status,headers});
function secret(name:string,legacy:string){
 try{
  const val=Deno.env.get(name),parsed=val?JSON.parse(val):null;
  return parsed?.default||Deno.env.get(legacy)||undefined;
 }catch{return Deno.env.get(legacy)||undefined;}
}
function detect(bytes:Uint8Array):{mime:string;ext:string}|null{
 if(bytes.length<12)return null;
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return {mime:"image/jpeg",ext:"jpg"};
 if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&
  bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)
  return {mime:"image/png",ext:"png"};
 if(new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&
   new TextDecoder().decode(bytes.slice(8,12))==="WEBP")return {mime:"image/webp",ext:"webp"};
 if(new TextDecoder().decode(bytes.slice(0,5))==="%PDF-")return {mime:"application/pdf",ext:"pdf"};
 return null;
}
Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(request.method!=="POST")return respond({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL");
 const publishable=secret("SUPABASE_PUBLISHABLE_KEYS","SUPABASE_ANON_KEY");
 const serviceKey=secret("SUPABASE_SECRET_KEYS","SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!publishable||!serviceKey)return respond({error:"service_not_configured"},503);
 const jwt=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!jwt)return respond({error:"authentication_required"},401);
 const client=createClient(url,publishable,{auth:{autoRefreshToken:false,persistSession:false},
   global:{headers:{Authorization:"Bearer "+jwt}}});
 const {data:{user},error:authError}=await client.auth.getUser(jwt);
 if(authError||!user?.id||!user.email_confirmed_at)return respond({error:"verified_sign_in_required"},401);
 const requestLength=Number(request.headers.get("content-length")||0);
 if(requestLength>maxBytes+512*1024)return respond({error:"request_too_large"},413);
 let releaseId:string,asset:File;
 try{
  const form=await request.formData();
  releaseId=String(form.get("release_id")||"");
  const candidate=form.get("file");
  if(!(candidate instanceof File))return respond({error:"file_required"},400);
  asset=candidate;
 }catch{return respond({error:"invalid_form_data"},400);}
 if(!uuid.test(releaseId))return respond({error:"invalid_release_id"},400);
 if(asset.size<1||asset.size>maxBytes)return respond({error:"invalid_file_size"},413);
 const [{data:release,error:releaseErr}]=await Promise.all([
  client.from("press_releases").select("id,organization_id,status").eq("id",releaseId).maybeSingle()
 ]);
 if(releaseErr||!release||!["draft","changes_requested"].includes(release.status))
  return respond({error:"release_unavailable_or_locked"},403);
 const {data:membership,error:membershipErr}=await client.from("organization_memberships")
  .select("role").eq("organization_id",release.organization_id).eq("user_id",user.id).maybeSingle();
 if(membershipErr||!["owner","admin","editor"].includes(membership?.role||""))
  return respond({error:"editor_role_required"},403);
 const bytes=new Uint8Array(await asset.arrayBuffer());
 if(bytes.length!==asset.size)return respond({error:"file_length_mismatch"},400);
 const detected=detect(bytes);
 if(!detected||asset.type!==detected.mime)return respond({error:"unsupported_or_spoofed_file_type"},415);
 if(detected.mime==="application/pdf"){
  const ascii=new TextDecoder("utf-8",{fatal:false}).decode(bytes);
  if(/\/(JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles?|RichMedia|XFA)\b/i.test(ascii))
   return respond({error:"active_pdf_content_not_permitted"},415);
 }
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 const sha256=Array.from(digest).map(byte=>byte.toString(16).padStart(2,"0")).join("");
 const filename=(asset.name||"attachment").replace(/[^\w.\- ]/g,"_").slice(0,255)||"attachment";
 const objectPath=release.organization_id+"/"+release.id+"/"+crypto.randomUUID()+"."+detected.ext;
 const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const {error:uploadErr}=await admin.storage.from("release-assets").upload(objectPath,bytes,{
  upsert:false,contentType:detected.mime,cacheControl:"private"
 });
 if(uploadErr)return respond({error:"private_storage_unavailable"},503);
 const {data:row,error:rowErr}=await admin.from("press_release_media").insert({
  organization_id:release.organization_id,
  release_id:release.id,
  object_path:objectPath,file_name:filename,mime_type:detected.mime,
  byte_size:asset.size,uploaded_by:user.id,sha256,
  validation_status:"basic_validated",validated_at:new Date().toISOString()
 }).select("id").single();
 if(rowErr||!row){
  await admin.storage.from("release-assets").remove([objectPath]);
  return respond({error:"metadata_storage_failed"},503);
 }
 return respond({media_id:row.id,validation:"basic_validated",
  note:"File signature and basic PDF checks passed; no antivirus clearance implied."});
});
