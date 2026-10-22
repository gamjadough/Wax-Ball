export function vectors(kind='cycle',{start=0,n=280,points=7,pauses=false,seed=47}={}){
 let t=start,r=seed>>>0;const next=()=>{r=(1664525*r+1013904223)>>>0;return r/4294967296;},out=[],phases=[31,62,95,44,83,57,48,72,36,91,51,68];
 for(let i=0;i<n;i++){
  if(i)t+=kind==='random-fast'?20+Math.floor(next()*26):kind==='human-loop'||kind==='human-random'?30+Math.floor(next()*110):phases[(i-1)%points];
  if(pauses&&i&&i%84===0)t+=1200;
  const angle=(i%points)/points*Math.PI*2,random=kind==='random-fast'||kind==='human-random';
  const x=random?Math.floor(next()*1001):Math.round(500+270*Math.cos(angle)+(next()-.5)*12),y=random?Math.floor(next()*1001):Math.round(500+270*Math.sin(angle)+(next()-.5)*12);
  out.push([t,x,y]);
 }
 return out;
}
