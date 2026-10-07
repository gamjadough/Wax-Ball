// Served only on the local preview URL. Production accounts are never connected.
(() => {
  const panel=document.createElement('aside');
  Object.assign(panel.style,{position:'fixed',top:'8px',left:'8px',right:'8px',zIndex:'100',padding:'12px',background:'#171923',border:'1px solid #e6c783',borderRadius:'12px',display:'flex',gap:'8px',flexWrap:'wrap'});
  const label=document.createElement('span');label.textContent='초월 로컬 테스트';panel.append(label);
  const select=document.createElement('select');select.id='transcendentPreview';
  WAKPPU_BALLS.filter(b=>b.grade==='초월').forEach(b=>{const option=document.createElement('option');option.value=b.id;option.textContent=b.name;select.append(option);});panel.append(select);
  for(const [mode,text] of [['last','마지막 1회 준비'],['normal','처음부터 타격'],['unlock','해금 테스트']]){
    const button=document.createElement('button');button.className='btn small';button.textContent=text;
    button.onclick=()=>WakppuGameTest.prepareLocalTranscendent(select.value,mode);panel.append(button);
  }
  document.body.append(panel);select.onchange=()=>WakppuGameTest.prepareLocalTranscendent(select.value);
  WakppuGameTest.prepareLocalTranscendent();
})();
