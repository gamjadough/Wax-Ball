(() => {
  'use strict';
  const config = window.WAKPPU_SERVER;
  if (!config?.url || !config?.anonKey || !window.supabase) return;

  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

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
    signInAnonymously: () => client.auth.signInAnonymously(),
    signOut: () => client.auth.signOut(),
  };
  client.auth.onAuthStateChange(() => window.dispatchEvent(new Event('wakppu-auth-changed')));
})();
