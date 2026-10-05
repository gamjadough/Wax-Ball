import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{}};
vm.runInNewContext(readFileSync(new URL('../wakppuball/js/hammers-data.js',import.meta.url),'utf8'),sandbox);
export const hammers=sandbox.window.WakppuHammers;
export const hammerDamage=(owned,level)=>owned?hammers[level-1]?.cracks||1:1;
