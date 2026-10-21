// No email enumeration endpoint, privileged keys, password storage or progress merging.
(() => {
 let busy=false;
 const marker=id=>'wakppu:skip-legacy-import:'+id;
 const duplicate=e=>['email_exists','user_already_exists','identity_already_exists'].includes(e?.code)||/email.*already.*(registered|exists)|already.*registered|이미 사용 중인 이메일/i.test(e?.message||'');
 async function run(mode,email,password){
  if(busy)return {error:Error('이미 계정을 처리 중입니다.')};
  busy=true;let verified=null,deleted=false,adopted=false,driver;
  try{
   const auth=WakppuAuth;driver=auth.guestDriver;const {data,error}=await auth.session();if(error)throw error;
   const original=data.session;if(!original?.user.is_anonymous)throw Error('빠른 시작 계정에서만 사용할 수 있습니다.');
   const actual=await driver.check(),missing=actual.error?.code==='user_not_found';if(actual.error&&!missing)throw actual.error;
   if(!missing&&(actual.data.user?.id!==original.user.id||actual.data.user.is_anonymous!==true))throw Error('계정이 변경되었습니다. 다시 확인해주세요.');
   if(mode==='switch'){
    verified=await driver.verify(email,password);if(verified.error)throw verified.error;
    const target=verified.data?.session;
    if(!target||target.user.is_anonymous||target.user.id===original.user.id||target.user.email?.toLowerCase()!==email.toLowerCase())throw Error('기존 이메일 계정의 로그인을 확인하지 못했습니다.');
    // Durable across reloads: never import the guest's local cache into the target account.
    localStorage.setItem(marker(target.user.id),'1');
   }else if(mode!=='logout')throw Error('잘못된 계정 요청입니다.');
   const latest=await auth.session();if(latest.error)throw latest.error;if(latest.data.session?.user.id!==original.user.id)throw Error('계정이 변경되었습니다. 삭제를 취소했습니다.');
   let result;try{result=await driver.discard(original);}catch(e){if(e.status)throw e;result=await driver.discard(original);}
   if(!result.deleted||result.user_id!==original.user.id)throw Error('삭제 결과를 확인하지 못했습니다.');
   deleted=true;window.WakppuGuestGame?.discarded();
   if(mode==='switch'){
    const switched=await driver.adopt(verified.data.session);if(switched.error)throw switched.error;adopted=true;
   }else{const cleared=await driver.clear();if(cleared.error)throw cleared.error;}
   return {deleted:true};
  }catch(error){if(deleted&&!adopted)try{await driver.clear();}catch(_){}return {error:deleted?Error('빠른 시작 계정 삭제는 완료됐습니다. 기존 이메일 계정으로 다시 로그인해주세요.'):error,deleted};}
  finally{
   if(verified&&!adopted)try{await verified.release?.();}catch(_){}
   busy=false;
   const {data}=await WakppuAuth.session();window.dispatchEvent(new CustomEvent('wakppu-auth-changed',{detail:{event:'GUEST_EXIT',user:data?.session?.user||null}}));
  }
 }
 window.WakppuGuestExit={get busy(){return busy;},run,duplicate,skipImport:id=>{try{return localStorage.getItem(marker(id))==='1';}catch(_){return true;}}};
})();
