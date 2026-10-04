import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
// 이전 클라이언트도 동일한 DB 권한 검증·점검·정밀한 Gold 처리를 통과합니다.
Deno.serve(async req => {
  const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers});
  try {
    const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
    const {data,error}=await client.rpc('wakppu_api',{b:await req.json()});
    const status=error ? (/^PT\d{3}$/.test(error.code)?Number(error.code.slice(2)):400) : 200;
    return new Response(JSON.stringify(error?{error:error.message}:data),{status,headers});
  }catch(_){return new Response(JSON.stringify({error:'Invalid request'}),{status:400,headers});}
});
