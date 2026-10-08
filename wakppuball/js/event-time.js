(function(root){
  'use strict';
  function format(seconds){
    let remaining=Number.isFinite(seconds)?Math.max(0,Math.ceil(seconds)):0;
    const parts=[];
    for(const [size,label] of [[86400,'일'],[3600,'시간'],[60,'분'],[1,'초']]){
      const amount=Math.floor(remaining/size);
      if(amount)parts.push(amount+label);
      remaining%=size;
    }
    return parts.join(' ')||'0초';
  }
  root.WakppuEventTime={format};
})(typeof window==='undefined'?globalThis:window);
