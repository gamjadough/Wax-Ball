(function(root) {
  // Short-scale names grow by 1,000. Abbreviations follow the existing game style.
  const suffixes=['','K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc','Ud',
    'Dd','Td','Qad','Qid','Sxd','Spd','Ocd','Nod','Vg','Uvg','Dvg','Tvg',
    'Qavg','Qivg','Sxvg','Spvg','Ocvg','Novg','Tg'];
  // Extend the short-scale Latin naming pattern through centillion (10^303).
  // Suffix spelling is a game convention, not an SI unit or universal standard.
  const ones=['','U','D','T','Qa','Qi','Sx','Sp','Oc','No'];
  const tens=['','','Vg','Tg','Qag','Qig','Sxg','Spg','Ocg','Nog'];
  for(let illion=31;illion<=99;illion++)suffixes.push(ones[illion%10]+tens[Math.floor(illion/10)]);
  suffixes.push('Ce');
  const bases=suffixes.map((_,index)=>1000n**BigInt(index));
  function decimal(tenth) { return `${tenth/10n}${tenth%10n?'.'+tenth%10n:''}`; }
  function scientific(n) {
    let exponent=n.toString().length-1;
    const base=10n**BigInt(exponent);
    let tenth=(n*10n+base/2n)/base;
    if(tenth>=100n){tenth=10n;exponent++;}
    return `${decimal(tenth)}e${exponent}`;
  }
  function integer(value) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) return BigInt(value);
    if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
    throw new Error('Gold는 0 이상의 정수여야 합니다.');
  }
  function compact(value) {
    let n; try { n=integer(value); } catch (_) { return '—'; }
    if(n<1000n)return n.toLocaleString('ko-KR');
    let tier=Math.floor((n.toString().length-1)/3);
    if(tier>=suffixes.length)return scientific(n);
    let base=bases[tier],tenth=(n*10n+base/2n)/base;
    // Round 999.95 of one unit up to the next instead of displaying 1000Ud.
    if(tenth>=10000n){
      tier++;
      if(tier>=suffixes.length)return scientific(n);
      base=bases[tier];tenth=(n*10n+base/2n)/base;
    }
    return `${decimal(tenth)}${suffixes[tier]}`;
  }
  root.WakppuGold={integer,compact};
})(typeof window==='undefined'?globalThis:window);
