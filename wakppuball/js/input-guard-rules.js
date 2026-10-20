(() => {
 const policy=Object.freeze({rate:40,burst:80,minSamples:120,minSpan:10000,maxSamples:512,reportGap:10000,serverHits:8,limitMs:120000});
 function analyze(samples){
  if(!Array.isArray(samples)||samples.length>policy.maxSamples)throw new Error('입력 기록 형식 오류');
  for(let i=0;i<samples.length;i++){
   const p=samples[i];if(!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isSafeInteger(x))||p[0]<0||p[0]>1e12||p[1]<0||p[1]>1000||p[2]<0||p[2]>1000||(i&&p[0]<samples[i-1][0]))throw new Error('입력 기록 범위 오류');
  }
  const n=samples.length,span=n>1?samples[n-1][0]-samples[0][0]:0;
  const intervals=samples.slice(1).map((p,i)=>p[0]-samples[i][0]),mean=intervals.length?span/intervals.length:0;
  const deviation=mean?Math.sqrt(intervals.reduce((s,x)=>s+(x-mean)**2,0)/intervals.length)/mean:1;
  const cells=new Map();for(const p of samples){const k=Math.round(p[1]/5)+':'+Math.round(p[2]/5);cells.set(k,(cells.get(k)||0)+1);}
  const fixed=n?Math.max(...cells.values())/n:0,cps=span?(n-1)*1000/span:0;
  const eligible=n>=policy.minSamples&&span>=policy.minSpan&&span<=30000;
  const fast=eligible&&cps>=10,regular=eligible&&deviation<=.02&&Math.max(...intervals)-Math.min(...intervals)<=4;
  return {count:n,span,cps,variation:deviation,fixed,fast,regular,suspect:fast&&regular,reasons:[...(fast?['지속적인 고속 입력']:[]),...(regular?['거의 동일한 입력 간격']:[]),...(eligible&&fixed>=.95?['같은 상대 좌표 반복']:[])]};
 }
 globalThis.WakppuInputGuardRules=Object.freeze({policy,analyze});
})();
