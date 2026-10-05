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

  async function invoke(action, payload = {}) {
    const { data: { session } } = await client.auth.getSession();
    if (!session && action !== 'status') throw new Error('로그인이 필요합니다.');
    const response = await fetch(`${config.url}/rest/v1/rpc/wakppu_api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
        'Authorization': `Bearer ${session?.access_token || config.anonKey}`,
      },
      body: JSON.stringify({ b: { action, ...payload } }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.message || result.error || '서버 요청에 실패했습니다.'), {status:response.status});
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
  };
  client.auth.onAuthStateChange((event, session) => window.dispatchEvent(new CustomEvent('wakppu-auth-changed', {
    detail: {event, user: session?.user || null},
  })));
})();
