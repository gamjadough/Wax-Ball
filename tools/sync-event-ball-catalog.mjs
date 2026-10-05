import {readFile,writeFile} from 'node:fs/promises';
import {ballCatalog} from './event-ball-catalog.mjs';
const path=new URL('../supabase/migrations/20261007_admin_ball_event.sql',import.meta.url);
const values=(await ballCatalog()).map(b=>`('${b.id}',${b.reward})`).join(',');
await writeFile(path,(await readFile(path,'utf8')).replace(/(insert into public\.wakppu_ball_rewards values\n)[\s\S]*?(\non conflict)/,`$1${values}$2`));
