const serviceUrl=()=>process.env.SUPABASE_URL?.replace(/\/$/,"");
const serviceKey=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
export function isStorageConfigured() { return Boolean(serviceUrl() && serviceKey()); }
export async function adminRequest(path:string, method="GET", body?:unknown, extra?:Record<string,string>) {
  const url=serviceUrl(),key=serviceKey();
  if(!url || !key) throw new Error("Waitlist storage not configured");
  const response=await fetch(url+"/rest/v1/"+path,{
    method,headers:{"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"return=representation",...extra},
    body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"
  });
  const raw=await response.text();
  let data:unknown=raw;
  try{data=raw?JSON.parse(raw):null}catch{}
  if(!response.ok) throw new Error("Supabase request failed ("+response.status+")");
  return data;
}
