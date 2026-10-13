import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(await readFile(new URL('../wakppuball/js/sleep-hours.js',import.meta.url),'utf8'),context);
export const sleepHours=context.window.WakppuSleepHours.at;
