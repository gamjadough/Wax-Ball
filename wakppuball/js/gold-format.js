(function(root) {
  function integer(value) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) return BigInt(value);
    if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
    throw new Error('Gold는 0 이상의 정수여야 합니다.');
  }
  function compact(value) {
    let n; try { n=integer(value); } catch (_) { return '—'; }
    // 짧은 영어권 idle 게임 표기: K, M, B, T 이후 Qa~Ud까지 3자리씩 확장합니다.
    const units=[
      [1000000000000000000000000000000000000n,'Ud'],
      [1000000000000000000000000000000000n,'Dc'],
      [1000000000000000000000000000000n,'No'],
      [1000000000000000000000000000n,'Oc'],
      [1000000000000000000000000n,'Sp'],
      [1000000000000000000000n,'Sx'],
      [1000000000000000000n,'Qi'],
      [1000000000000000n,'Qa'],
      [1000000000000n,'T'],[1000000000n,'B'],[1000000n,'M'],[1000n,'K'],
    ];
    for (const [base,suffix] of units) if(n>=base) {const tenth=(n*10n+base/2n)/base;return `${tenth/10n}${tenth%10n?'.'+tenth%10n:''}${suffix}`;}
    return n.toLocaleString('ko-KR');
  }
  root.WakppuGold={integer,compact};
})(typeof window==='undefined'?globalThis:window);
