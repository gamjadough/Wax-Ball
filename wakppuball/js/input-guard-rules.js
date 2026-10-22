(() => {
 const policy=Object.freeze({rate:40,burst:80,minSamples:120,minSpan:10000,maxSamples:2048,reportGap:10000,serverHits:8,limitMs:120000,softRate:12,softBurst:24,softMs:30000});
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
  // Ignore long respawn/network pauses for active-speed measurement, not for elapsed evidence.
  const active=intervals.filter(d=>d>0&&d<=250),activeSpan=active.reduce((a,b)=>a+b,0),activeCps=activeSpan?active.length*1000/activeSpan:0;
  const extended=n>=120&&span>=6000&&span<=30000&&activeSpan>=4000,extreme=n>=120&&span>=2000&&span<=30000&&cps>=60;
  const overspeed=(extended&&activeCps>=25)||extreme;
  // Greedy, bounded 3.5%-radius clusters tolerate subpixel/squash jitter. Raw coordinates are not persisted.
  const centers=[],labels=[],segments=[],frequency=[];let segment=0,overflow=false;
  for(let i=0;i<n;i++){
   if(i&&intervals[i-1]>250)segment++;segments.push(segment);
   const p=samples[i];let label=centers.findIndex(c=>(c[0]-p[1])**2+(c[1]-p[2])**2<=1225);
   if(label<0&&centers.length<16){label=centers.length;centers.push([p[1],p[2]]);frequency.push(0);}else if(label<0)overflow=true;
   labels.push(label);if(label>=0)frequency[label]++;
  }
  // Several fingers arriving in the same event-time batch are not a sequential macro.
  const batchRatio=intervals.length?intervals.filter(d=>d<=8).length/intervals.length:0,simultaneous=centers.length>=3&&!overflow&&batchRatio>=.35;
  let period=0,accuracy=0,timing=0,cycleCv=1;
  if((extended||extreme)&&activeCps>=10&&!overflow&&!simultaneous){
   for(let k=3;k<=12;k++){
    if(frequency.filter(c=>c>=n/(2*k)).length<3)continue;
    let pairs=0,matches=0,times=0,timeMatches=0;const durations=[];
    for(let i=k;i<n;i++){
     if(segments[i]!==segments[i-k]||labels[i]<0||labels[i-k]<0)continue;
     pairs++;if(labels[i]===labels[i-k])matches++;
     if(i>k&&segments[i-k]===segments[i-k-1]){times++;if(Math.abs(intervals[i-1]-intervals[i-k-1])<=6)timeMatches++;}
     if(i%k===0)durations.push(samples[i][0]-samples[i-k][0]);
    }
    const mean=durations.reduce((a,b)=>a+b,0)/(durations.length||1),cv=mean?Math.sqrt(durations.reduce((a,d)=>a+(d-mean)**2,0)/(durations.length||1))/mean:1;
    const a=pairs?matches/pairs:0,t=times?timeMatches/times:0;
    if(pairs>=100&&durations.length>=8&&a>=.92&&t>=.85&&cv<=.12){period=k;accuracy=a;timing=t;cycleCv=cv;break;}
   }
  }
  const cyclic=period>0;
  return {count:n,span,cps,variation:deviation,fixed,fast,regular,active_cps:activeCps,active_span:activeSpan,clusters:centers.length+(overflow?1:0),batch_ratio:batchRatio,simultaneous,loop_period:period,loop_accuracy:accuracy,timing_repeat:timing,cycle_cv:cycleCv,cyclic,overspeed,suspect:fast&&regular&&!simultaneous||cyclic,reasons:[...(fast?['지속적인 고속 입력']:[]),...(regular?['거의 동일한 입력 간격']:[]),...(eligible&&fixed>=.95?['같은 상대 좌표 반복']:[]),...(cyclic?['다중 위치 순환 반복','반복되는 순환 입력 주기']:[]),...(overspeed?['지속적인 과속 입력 · 일시적 속도 제한 대상']:[])]};
 }
 globalThis.WakppuInputGuardRules=Object.freeze({policy,analyze});
})();
