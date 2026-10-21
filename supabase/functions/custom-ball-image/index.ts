import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {PNG} from 'npm:pngjs@7.0.0';
import {createHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createHandler({PNG,clients:(authorization:string)=>({service,user:createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})})}));
