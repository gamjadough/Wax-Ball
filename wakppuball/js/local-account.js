// 로컬 서버가 HTML 응답에서만 주입합니다. 운영 account.js와 운영 데이터는 사용하지 않습니다.
(() => {
  let saved=JSON.parse(sessionStorage.getItem('wakppu-local-session')||'null');
  async function request(url,body){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(saved?{Authorization:`Bearer ${saved.token}`}:{})},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error),{status:response.status});return result;}
  async function login(email,password){try{saved=await request('/local/login',{email,password});sessionStorage.setItem('wakppu-local-session',JSON.stringify(saved));return {data:{session:saved},error:null};}catch(error){return {error};}}
  window.WakppuAuth={local:true,session:async()=>({data:{session:saved?{user:saved.user}:null}}),invoke:(action,payload={})=>request('/local/api',{action,...payload}),signIn:login,signUp:async()=>({error:new Error('로컬 테스트에서는 회원가입 대신 테스트 로그인을 사용하세요.')}),signInAnonymously:()=>saved?Promise.resolve({data:{session:saved},error:null}):login('guest',''),signOut:async()=>{if(saved?.user.is_anonymous)return {error:new Error('빠른 시작 계정은 이 브라우저에서 유지됩니다. 닉네임 변경을 사용해주세요.')};saved=null;sessionStorage.removeItem('wakppu-local-session');return {error:null};}};
  document.addEventListener('DOMContentLoaded',()=>{const note=document.createElement('div');note.className='local-banner';note.textContent='로컬 테스트 · 샘플 데이터 · 운영 서버와 연결되지 않음';document.body.append(note);});
})();
