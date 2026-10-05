import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
export async function ballCatalog(){return JSON.parse(JSON.stringify(vm.runInNewContext((await readFile(new URL('../wakppuball/js/balls-data.js',import.meta.url),'utf8'))+'\nWAKPPU_BALLS.map(b=>({id:b.id,reward:b.reward}));')));}
