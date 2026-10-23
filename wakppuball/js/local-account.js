// 로컬 서버가 HTML 응답에서만 주입합니다. 운영 account.js와 운영 데이터는 사용하지 않습니다.
(() => {
  let saved=JSON.parse(sessionStorage.getItem('wakppu-local-session')||'null');
  async function request(url,body,session=saved,{signal}={}){const response=await fetch(url,{signal,method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.token}`}:{})},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error),{status:response.status,code:result.code});return result;}
  async function login(email,password){try{saved=await request('/local/login',{email,password});sessionStorage.setItem('wakppu-local-session',JSON.stringify(saved));return {data:{session:saved},error:null};}catch(error){return {error};}}
  async function accountUpdate(url,body={}){
    try{const result=await request(url,body);saved.user=result.user;sessionStorage.setItem('wakppu-local-session',JSON.stringify(saved));window.dispatchEvent(new CustomEvent('wakppu-auth-changed',{detail:{event:'USER_UPDATED',user:saved.user}}));return {data:{user:saved.user,session:saved},error:null};}
    catch(error){return {error};}
  }
  window.WakppuAuth={
    local:true,session:async()=>({data:{session:saved}}),
    invoke:(action,payload={},options={})=>request('/local/api',{action,...payload},saved,options),signIn:login,
    signUp:async()=>({error:new Error('로컬 테스트에서는 회원가입 대신 테스트 로그인을 사용하세요.')}),
    signInAnonymously:()=>saved?Promise.resolve({data:{session:saved},error:null}):login('guest',''),
    linkEmail:email=>accountUpdate('/local/email-link',{email}),
    refreshUser:()=>accountUpdate('/local/verify-email'),
    completeEmailLink:password=>accountUpdate('/local/complete-email-link',{password}),
    // Available only when the loopback server explicitly enables mock payments.
    mockCompleteEmailLink:()=>accountUpdate('/local/payments-demo-link'),
    signOut:async()=>{
      if(saved?.user.is_anonymous||saved?.user.user_metadata?.wakppu_email_link_pending)return {error:new Error('이메일 연결·인증·비밀번호 설정을 먼저 완료해주세요.')};
      saved=null;sessionStorage.removeItem('wakppu-local-session');return {error:null};
    },
    guestDriver:{
      check:async()=>({data:{user:(await request('/local/current',{})).user},error:null}),
      verify:async(email,password)=>{try{const session=await request('/local/login',{email,password});return {data:{session},error:null,release:async()=>{}};}catch(error){return {error};}},
      discard:session=>request('/local/api',{action:'guest_discard',expected_user_id:session.user.id,confirmation:'DELETE_GUEST'},session),
      adopt:async session=>{saved=session;sessionStorage.setItem('wakppu-local-session',JSON.stringify(saved));return {error:null};},
      clear:async()=>{saved=null;sessionStorage.removeItem('wakppu-local-session');return {error:null};},
    },
  };
  document.addEventListener('DOMContentLoaded',()=>{const note=document.createElement('div');note.className='local-banner';note.textContent='로컬 테스트 · 샘플 데이터 · 운영 서버와 연결되지 않음';document.body.append(note);});
})();
