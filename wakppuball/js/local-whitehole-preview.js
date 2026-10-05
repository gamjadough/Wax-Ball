// Injected only by the local server on ?preview=whitehole.
(() => {
  const panel=document.createElement('aside');panel.className='local-whitehole-preview';
  const text=document.createElement('p');text.textContent='화이트홀 로컬 미리보기 · 기본 보상 15,000,000G · 운영 계정과 연결되지 않습니다.';panel.append(text);
  for(const [mode,label] of [['last','마지막 한 클릭 준비'],['normal','240회 직접 플레이'],['unlock','1경 G로 해금 테스트']]){
    const button=document.createElement('button');button.type='button';button.className='btn small';button.textContent=label;button.onclick=()=>WakppuGameTest.prepareLocalWhitehole(mode);panel.append(button);
  }
  document.body.append(panel);WakppuGameTest.prepareLocalWhitehole('last');
})();
