'use strict';
(() => {
  const SESSION_KEY = 'wax-ball-arena.firebase-auth.v1';
  const validMatch = match => match && /^[a-f0-9-]{36}$/i.test(match.id) && ['victory','defeat'].includes(match.result)
    && Object.hasOwn(window.WaxArena.AI_DIFFICULTIES, match.difficulty) && Number.isSafeInteger(match.durationMs)
    && match.durationMs >= 0 && match.durationMs <= 86400000 && Number.isSafeInteger(match.completedAt) && match.completedAt >= 0;
  class AccountClient {
    constructor(config = window.WaxArena.ACCOUNT_CONFIG) { this.config = config; this.session = null; this.refreshing = null; }
    get configured() {
      return !!this.config.apiKey && /^[a-z][a-z0-9-]{4,29}$/.test(this.config.projectId)
        && /^https:\/\/[a-z0-9.-]+\.(firebaseio\.com|firebasedatabase\.app)$/.test(this.config.databaseURL);
    }
    async request(url, body, method = 'POST', extraHeaders = {}) {
      if (!this.configured) throw new Error('온라인 계정 서버를 준비 중입니다. 지금은 게스트로 플레이해 주세요.');
      let response;
      try { response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...extraHeaders }, ...(body === undefined ? {} : { body: extraHeaders['Content-Type'] === 'application/x-www-form-urlencoded' ? new URLSearchParams(body).toString() : JSON.stringify(body) }), signal: AbortSignal.timeout(15000) }); }
      catch { throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.'); }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const code = (data?.error?.message || '').split(' : ')[0];
        const messages = { INVALID_LOGIN_CREDENTIALS: '이메일 또는 비밀번호를 확인해 주세요.', INVALID_PASSWORD: '이메일 또는 비밀번호를 확인해 주세요.', EMAIL_NOT_FOUND: '이메일 또는 비밀번호를 확인해 주세요.', EMAIL_EXISTS: '이미 가입된 이메일입니다. 로그인해 주세요.', TOO_MANY_ATTEMPTS_TRY_LATER: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', WEAK_PASSWORD: '비밀번호를 8자 이상 입력해 주세요.', TOKEN_EXPIRED: '로그인이 만료되었습니다. 다시 로그인해 주세요.', INVALID_ID_TOKEN: '다시 로그인해 주세요.', USER_DISABLED: '이 계정은 사용할 수 없습니다.' };
        const error = new Error(messages[code] || (response.status === 429 ? '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' : '요청을 처리하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'));
        error.status = response.status; error.code = code; throw error;
      }
      return data;
    }
    auth(action, body) { return this.request('https://identitytoolkit.googleapis.com/v1/accounts:' + action + '?key=' + encodeURIComponent(this.config.apiKey), body); }
    saveSession(data) {
      if (!data?.idToken || !data?.refreshToken || !data?.localId) throw new Error('로그인 응답을 확인하지 못했습니다.');
      this.session = { access_token: data.idToken, refresh_token: data.refreshToken, user: { id: data.localId, email: data.email, user_metadata: { nickname: data.displayName || '온라인 공' } }, expires_at: Math.floor(Date.now() / 1000) + Number(data.expiresIn || 3600) };
      this.persistSession();
    }
    persistSession() { try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.session)); } catch {} }
    async restore() {
      if (!this.configured) return;
      try { this.session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY)); } catch { this.session = null; }
      if (!this.session?.user?.id || !this.session?.refresh_token || !this.session?.access_token) { this.clear(); return; }
      await this.accessToken(); await this.verify();
    }
    async verify() {
      const data = await this.auth('lookup', { idToken: await this.accessToken() }); const user = data?.users?.[0];
      if (!user?.emailVerified) { this.clear(); throw new Error('이메일의 인증 링크를 먼저 눌러주세요.'); }
      this.session.user = { id: user.localId, email: user.email, user_metadata: { nickname: user.displayName || '온라인 공' } }; this.persistSession();
    }
    async accessToken() {
      if (!this.session) throw new Error('로그인해 주세요.');
      if (this.session.expires_at <= Date.now() / 1000 + 60) {
        if (!this.refreshing) this.refreshing = this.request('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(this.config.apiKey), { grant_type: 'refresh_token', refresh_token: this.session.refresh_token }, 'POST', { 'Content-Type': 'application/x-www-form-urlencoded' })
          .then(data => { this.session.access_token = data.id_token; this.session.refresh_token = data.refresh_token; this.session.expires_at = Math.floor(Date.now() / 1000) + Number(data.expires_in); this.persistSession(); })
          .catch(error => { if (error.status === 400 || error.status === 401) this.clear(); throw error; }).finally(() => { this.refreshing = null; });
        await this.refreshing;
      }
      if (!this.session) throw new Error('로그인해 주세요.'); return this.session.access_token;
    }
    async signIn(email, password) {
      this.saveSession(await this.auth('signInWithPassword', { email, password, returnSecureToken: true }));
      try { await this.verify(); } catch (error) { this.clear(); throw error; }
    }
    async signUp(email, password, nickname) {
      const registered = await this.auth('signUp', { email, password, returnSecureToken: true });
      await this.auth('update', { idToken: registered.idToken, displayName: nickname, returnSecureToken: false });
      try { await this.auth('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: registered.idToken }); }
      catch { throw new Error('계정은 생성했지만 인증 메일을 보내지 못했습니다. 로그인 탭에서 인증 메일을 다시 요청해 주세요.'); }
      return false;
    }
    async resendVerification(email, password) {
      const data = await this.auth('signInWithPassword', { email, password, returnSecureToken: true });
      await this.auth('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: data.idToken });
    }
    async resetPassword(email) {
      try { await this.auth('sendOobCode', { requestType: 'PASSWORD_RESET', email }); }
      catch (error) { if (error.code !== 'EMAIL_NOT_FOUND') throw error; }
    }
    clear() { this.session = null; try { window.sessionStorage.removeItem(SESSION_KEY); } catch {} }
    async signOut() { this.clear(); }
    async database(path, body, method = 'GET', headers = {}) {
      const url = this.config.databaseURL + '/arena/users/' + encodeURIComponent(this.session.user.id) + '/matches' + path + '.json';
      try { return await this.request(url + '?auth=' + encodeURIComponent(await this.accessToken()), body, method, headers); }
      catch (error) { if (error.status !== 401 || !this.session) throw error; this.session.expires_at = 0; return this.request(url + '?auth=' + encodeURIComponent(await this.accessToken()), body, method, headers); }
    }
    async fetchProgress() {
      const records = await this.database(''); const matches = Object.values(records || {}).filter(validMatch);
      const wins = matches.filter(match => match.result === 'victory').length;
      return { version: 1, gold: wins * window.WaxArena.WIN_REWARD, wins, losses: matches.length - wins, history: matches.sort((a,b) => a.completedAt - b.completedAt || a.id.localeCompare(b.id)).slice(-100) };
    }
    async recordMatch(match) {
      if (!validMatch(match)) throw new RangeError('Invalid match result');
      if (await this.database('/' + match.id)) return;
      try { await this.database('/' + match.id, { ...match, completedAt: { '.sv': 'timestamp' } }, 'PUT', { 'if-match': 'null_etag' }); }
      catch (error) { if (error.status !== 412 && error.status !== 401) throw error; if (!await this.database('/' + match.id)) throw error; }
    }
  }
  class CloudProgressStore {
    constructor(client) {
      this.client = client; this.userId = client.session.user.id; this.key = 'wax-ball-arena.cloud.v1.' + this.userId;
      this.state = { version: 1, gold: 0, wins: 0, losses: 0, history: [], issue: 'loading' };
      this.pending = []; this.onChange = () => {}; this.syncing = null; this.durable = true; this.acknowledged = new Set();
      try {
        const saved = JSON.parse(window.localStorage.getItem(this.key));
        if (saved?.state && Array.isArray(saved.pending)) { this.accept(saved.state); this.state.issue = 'offline'; this.pending = saved.pending.filter(validMatch); }
      } catch {}
    }
    accept(state) {
      if (!state || !['gold','wins','losses'].every(key => Number.isSafeInteger(state[key]) && state[key] >= 0) || !Array.isArray(state.history)) throw new Error('계정 기록을 읽지 못했습니다.');
      this.state = { version: 1, gold: state.gold, wins: state.wins, losses: state.losses, history: state.history.filter(validMatch).slice(-100), issue: '' };
    }
    getSnapshot() { return { ...this.state, history: this.state.history.map(match => ({ ...match })), pending: this.pending.length }; }
    persist() {
      try {
        const saved = JSON.parse(window.localStorage.getItem(this.key));
        const other = (saved?.pending || []).filter(validMatch).filter(match => !this.acknowledged.has(match.id) && !this.state.history.some(done => done.id === match.id));
        this.pending = [...new Map([...other, ...this.pending].map(match => [match.id, match])).values()];
        window.localStorage.setItem(this.key, JSON.stringify({ state: this.state, pending: this.pending })); this.durable = true; return true;
      } catch { this.durable = false; return false; }
    }
    async refresh() {
      if (this.syncing) return this.syncing;
      this.syncing = this.sync().finally(() => { this.syncing = null; }); return this.syncing;
    }
    async sync() {
      try {
        if (this.client.session?.user.id !== this.userId) throw new Error('계정이 변경되었습니다. 다시 로그인해 주세요.');
        while (this.pending.length) {
          const match = this.pending[0]; await this.client.recordMatch(match);
          this.accept(await this.client.fetchProgress()); this.acknowledged.add(match.id); this.pending.shift(); this.persist(); this.onChange();
        }
        this.accept(await this.client.fetchProgress()); this.persist();
      } catch { this.state.issue = this.pending.length ? (this.durable ? 'pending' : 'volatile') : 'offline'; }
      this.onChange();
    }
    recordResult(id, result, difficulty, durationMs) {
      const match = { id, result, difficulty, durationMs: Math.round(durationMs), completedAt: Date.now() };
      if (!validMatch(match)) throw new RangeError('Invalid match result');
      if (this.pending.some(row => row.id === id) || this.state.history.some(row => row.id === id)) return null;
      this.pending.push(match); this.state.issue = this.persist() ? 'pending' : 'volatile'; this.onChange(); void this.refresh();
      return { id, result, reward: result === 'victory' ? window.WaxArena.WIN_REWARD : 0, cloud: true };
    }
  }
  window.WaxArena.AccountClient = AccountClient; window.WaxArena.CloudProgressStore = CloudProgressStore;
})();
