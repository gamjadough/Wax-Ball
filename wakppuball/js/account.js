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
      return { error: new Error('빠른 시작 계정은 이 브라우저에서 유지됩니다. 닉네임 변경을 사용해주세요.') };
    }
    return client.auth.signOut();
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
  };
  client.auth.onAuthStateChange(() => window.dispatchEvent(new Event('wakppu-auth-changed')));
})();
