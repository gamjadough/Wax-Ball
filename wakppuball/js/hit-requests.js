// Compact input buffer and bounded, idempotent transport for real pointer hits.
(() => {
 function createQueue(){let count=0,last=null;return {get length(){return count;},push(point){last=point;count++;},shift(){if(!count)return undefined;count--;return last;},clear(){count=0;last=null;}};}
 function cancelled(){return Object.assign(new Error('플레이 상태가 변경되었습니다.'),{cancelled:true});}
 async function run(operation,{valid=()=>true,onRetry=()=>{},timeoutMs=8000,attempts=3,retryDelayMs=500}={}){
  for(let attempt=0;attempt<attempts;attempt++){
   if(!valid())throw cancelled();const controller=new AbortController();let timer;
   try{
    const expired=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(new Error('서버 응답이 늦어 다시 연결합니다.'),{timeout:true}));},timeoutMs);});
    const result=await Promise.race([Promise.resolve().then(()=>operation(controller.signal)),expired]);if(!valid())throw cancelled();return result;
   }catch(error){
    clearTimeout(timer);
    if(error.cancelled||!valid())throw cancelled();if(error.status||attempt+1>=attempts)throw error;
    onRetry(attempt+1,error);await new Promise(resolve=>setTimeout(resolve,retryDelayMs*(attempt+1)));
   }finally{clearTimeout(timer);}
  }
 }
 globalThis.WakppuHitRequests={createQueue,run,send:(action,request,options)=>run(signal=>WakppuAuth.invoke(action,request,{signal}),options)};
})();
