(() => {
  const entries = [
    ['나무 망치',3,100n],['강화 나무 망치',5,500n],['단단한 나무 망치',8,2000n],
    ['철제 보강 망치',12,10000n],['강철 망치',18,50000n],['중형 강철 망치',27,250000n],
    ['강화 강철 망치',40,1000000n],['특수 합금 망치',60,5000000n],['고급 합금 망치',90,25000000n],
    ['초고급 합금 망치',135,100000000n],
  ].map(([name,cracks,cost])=>({name,cracks,cost}));
  const tiers=['미스릴 망치','티타늄 망치','우주 망치','특이점 망치'];
  for(let level=11;level<=30;level++){
    const previous=entries[entries.length-1];
    entries.push({name:`${tiers[Math.floor((level-11)/5)]} · ${(level-11)%5+1}단계`,
      cracks:Math.ceil(previous.cracks*1.5),cost:previous.cost*4n});
  }
  window.WakppuHammers=Object.freeze(entries.map(Object.freeze));
})();
