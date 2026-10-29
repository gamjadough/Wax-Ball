(() => {
  'use strict';
  const config = window.WAKPPU_SERVER;
  if (!config?.url || !config?.anonKey || !window.supabase) return;

  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  let guestStartPromise;
  function startGuest() {
    if (guestStartPromise) return guestStartPromise;
    const reuseOrCreate = async () => {
      const { data, error } = await client.auth.getSession();
      if (error) return { data, error };
      if (data.session) return { data: { session: data.session, user: data.session.user }, error: null };
      return client.auth.signInAnonymously();
    };
    // 같은 브라우저의 여러 탭에서도 최초 생성 요청을 순서대로 처리합니다.
    guestStartPromise = (globalThis.navigator?.locks
      ? navigator.locks.request('wakppu-guest-start', reuseOrCreate)
      : reuseOrCreate()).finally(() => { guestStartPromise = null; });
    return guestStartPromise;
  }

  async function signOut() {
    const { data, error } = await client.auth.getSession();
    if (error) return { error };
    if (data.session?.user.is_anonymous) {
      return { error: new Error('먼저 이메일 연결과 인증, 비밀번호 설정을 완료해주세요. 기존 계정을 유지한 채 로그아웃할 수 있습니다.') };
    }
    if (data.session?.user.user_metadata?.wakppu_email_link_pending) return {error: new Error('이메일 연결을 마치려면 비밀번호를 설정해주세요.')};
    return client.auth.signOut();
  }

  async function linkEmail(email) {
    const {data, error} = await client.auth.getUser();
    if (error) return {error};
    if (!data.user?.is_anonymous) return {error: new Error('빠른 시작 계정에서 이메일을 연결해주세요.')};
    return client.auth.updateUser({email, data: {wakppu_email_link_pending: true}}, {
      emailRedirectTo: 'https://gamjadough.github.io/Wax-Ball/wakppuball/',
    });
  }
  async function completeEmailLink(password) {
    const {data, error} = await client.auth.getUser();
    if (error) return {error};
    const user = data.user;
    if (!user?.email_confirmed_at || user.is_anonymous || !user.user_metadata?.wakppu_email_link_pending) {
      return {error: new Error('먼저 메일의 인증 링크를 눌러 이메일 인증을 완료해주세요.')};
    }
    return client.auth.updateUser({password, data: {wakppu_email_link_pending: false}});
  }

  async function invoke(action, payload = {}, {signal} = {}) {
    if(window.WakppuGuestExit?.busy)throw new Error('계정을 전환 중입니다. 잠시 기다려주세요.');
    const expectedAccount=window.WakppuItemGame?.read().account;
    const { data: { session } } = await client.auth.getSession();
    if(expectedAccount&&session?.user.id!==expectedAccount&&!['status','rankings','monthly_rankings','bootstrap'].includes(action))throw new Error('계정이 변경되었습니다. 다시 시도해주세요.');
    if (!session && !['status','rankings','monthly_rankings'].includes(action)) throw new Error('로그인이 필요합니다.');
    const response = await fetch(`${config.url}/rest/v1/rpc/wakppu_api`, {
      method: 'POST',signal,
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
        'Authorization': `Bearer ${session?.access_token || config.anonKey}`,
      },
      body: JSON.stringify({ b: { action, ...payload } }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.message || result.error || '서버 요청에 실패했습니다.'), {status:response.status,code:result.code});
    return result;
  }

  window.WakppuAuth = {
    client,
    invoke,
    session: () => client.auth.getSession(),
    signUp: (email, password) => client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: 'https://gamjadough.github.io/Wax-Ball/wakppuball/' },
    }),
    signIn: (email, password) => client.auth.signInWithPassword({ email, password }),
    signInAnonymously: startGuest,
    signOut,
    linkEmail,
    completeEmailLink,
    refreshUser: () => client.auth.refreshSession(),
    guestDriver:{
      verify:async(email,password)=>{
        const isolated=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'wakppu-switch-'+crypto.randomUUID()}});
        const result=await isolated.auth.signInWithPassword({email,password});
        return {...result,release:()=>isolated.auth.signOut({scope:'local'})};
      },
      check:async()=>client.auth.getUser(),
      discard:async session=>{
        const response=await fetch(`${config.url}/rest/v1/rpc/wakppu_api`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.anonKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify({b:{action:'guest_discard',confirmation:'DELETE_GUEST',expected_user_id:session.user.id}})});
        const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.message||'삭제하지 못했습니다. 다시 시도해주세요.'),{status:response.status});return result;
      },
      adopt:session=>client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token}),
      clear:()=>client.auth.signOut({scope:'local'}),
    },
  };
  client.auth.onAuthStateChange((event, session) => !window.WakppuGuestExit?.busy&&window.dispatchEvent(new CustomEvent('wakppu-auth-changed', {
    detail: {event, user: session?.user || null},
  })));
})();
