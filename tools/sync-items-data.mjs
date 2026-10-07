// Generate server configuration from the same catalog used by the client UI.
import {readFile,writeFile} from 'node:fs/promises';
import {itemData} from './items-service.mjs';
const file=new URL('../supabase/migrations/20261012_items_inventory.sql',import.meta.url);
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const defs=itemData.list.map(d=>[quote(d.id),quote(d.rank),d.seconds,quote(d.group),d.value,d.count,quote(d.unit)].join(',')).map(s=>'('+s+')').join(',');
const ranks=itemData.ranks.map((r,i)=>'('+quote(r.id)+','+i+','+r.weight+')').join(',');
const block='-- ITEM_CONFIG_BEGIN\ninsert into public.wakppu_item_defs values '+defs+' on conflict(item_id) do update set rank=excluded.rank,seconds=excluded.seconds,channel=excluded.channel,value=excluded.value,charges=excluded.charges,unit=excluded.unit;\ninsert into public.wakppu_item_ranks values '+ranks+' on conflict(rank) do update set position=excluded.position,weight=excluded.weight;\n-- ITEM_CONFIG_END';
await writeFile(file,(await readFile(file,'utf8')).replace(/-- ITEM_CONFIG_BEGIN[\s\S]*?-- ITEM_CONFIG_END/,block));
