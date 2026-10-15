'use strict';
(() => {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let sdkPromise;
  async function loadSdk() {
    if (!sdkPromise) sdkPromise = (async () => {
      const base = 'https://www.gstatic.com/firebasejs/13.0.0/';
      const [appSdk, authSdk, dbSdk] = await Promise.all(['firebase-app.js','firebase-auth.js','firebase-database.js'].map(file => import(base + file)));
      const app = appSdk.getApps().find(app => app.name === 'arena-friends') || appSdk.initializeApp(window.WaxArena.ACCOUNT_CONFIG, 'arena-friends');
      const auth = authSdk.getAuth(app);
      await auth.authStateReady();
      if (!auth.currentUser) await authSdk.signInAnonymously(auth);
      return { ...dbSdk, db: dbSdk.getDatabase(app), uid: auth.currentUser.uid };
    })().catch(error => { sdkPromise = null; throw error; });
    return sdkPromise;
  }
  function roomCode() {
    return [...crypto.getRandomValues(new Uint8Array(8))].map(value => ALPHABET[value % ALPHABET.length]).join('');
  }
  function view(room, uid, now) {
    if (!room || now - room.createdAt >= 3600000) return { stage: 'closed' };
    const side = room.players?.host?.uid === uid ? 'host' : room.players?.guest?.uid === uid ? 'guest' : null;
    if (!side) return { stage: 'closed' };
    const opponent = side === 'host' ? 'guest' : 'host';
    const me = room.players[side], other = room.players[opponent];
    const winner = room.forfeit ? (room.forfeit === 'host' ? 'guest' : 'host') : room.players.host.clicks >= 500 ? 'host' : other && room.players.guest.clicks >= 500 ? 'guest' : null;
    const countdown = room.startedAt ? Math.max(0, Math.ceil((room.startedAt + 3000 - now) / 1000)) : 0;
    const stage = winner ? 'ended' : !other ? 'waiting' : !room.startedAt ? 'ready' : countdown ? 'countdown' : !me.online || !other.online || !me.active || !other.active ? 'paused' : 'playing';
    return { stage, side, opponent, me, other, winner, won: winner === side, countdown,
      playerHp: 1000 - Math.floor((other?.clicks || 0) / 5) * 10,
      opponentHp: 1000 - Math.floor(me.clicks / 5) * 10,
      canClaim: !!room.startedAt && !winner && !!other && !other.online && now - other.lastSeenAt >= 20000 };
  }
  class FriendRoom {
    constructor() { this.room = null; this.loaded = false; this.code = ''; this.closed = false; this.connected = false; this.listeners = []; this.onChange = () => {}; this.onError = () => {}; this.offset = 0; this.hitting = false; }
    now() { return Date.now() + this.offset; }
    snapshot() { return { ...(this.loaded ? view(this.room, this.sdk?.uid, this.now()) : { stage: 'connecting' }), code: this.code, connected: this.connected, hitting: this.hitting }; }
    async init(name) {
      this.name = String(name).trim().slice(0,20);
      if (!this.name) throw new Error('친구에게 보여줄 이름을 입력해 주세요.');
      try { this.sdk = await loadSdk(); }
      catch { throw new Error('친구 대전 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.'); }
      if (this.closed) throw new Error('방 연결을 취소했습니다.');
    }
    player() { return { uid: this.sdk.uid, name: this.name, clicks: 0, lastHitAt: 0, ready: false, online: true, active: true, lastSeenAt: this.sdk.serverTimestamp() }; }
    async create(name) {
      await this.init(name);
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = roomCode(), ref = this.sdk.ref(this.sdk.db, 'arena/duels/' + code);
        const result = await this.sdk.runTransaction(ref, existing => existing ? undefined : { version: 1, createdAt: this.sdk.serverTimestamp(), players: { host: this.player() } }, { applyLocally: false });
        if (result.committed) {
          if (this.closed) { await this.sdk.remove(ref); throw new Error('방 연결을 취소했습니다.'); }
          return this.attach(code, 'host');
        }
      }
      throw new Error('방을 만들지 못했습니다. 다시 시도해 주세요.');
    }
    async join(code, name) {
      code = String(code).trim().toUpperCase();
      if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) throw new Error('8자리 방 코드를 확인해 주세요.');
      await this.init(name);
      const roomRef = this.sdk.ref(this.sdk.db, 'arena/duels/' + code);
      let room;
      try { room = (await this.sdk.get(roomRef)).val(); }
      catch { throw new Error('방 코드를 확인해 주세요. 종료됐거나 이미 가득 찬 방입니다.'); }
      if (!room || this.now() - room.createdAt > 3600000) throw new Error('방이 없거나 만료되었습니다. 새 방 코드를 받아주세요.');
      let side = room.players.host.uid === this.sdk.uid ? 'host' : 'guest';
      if (side === 'guest' && room.players.guest?.uid !== this.sdk.uid) {
        if (room.startedAt || room.players.guest) throw new Error('이미 대전 중이거나 가득 찬 방입니다.');
        const result = await this.sdk.runTransaction(this.sdk.ref(this.sdk.db, 'arena/duels/' + code + '/players/guest'), existing => existing ? undefined : this.player(), { applyLocally: false });
        if (!result.committed) throw new Error('다른 친구가 먼저 들어왔습니다. 새 방을 만들어 주세요.');
      }
      if (this.closed) {
        if (!room.startedAt && side === 'guest') await this.sdk.remove(this.sdk.ref(this.sdk.db, 'arena/duels/' + code + '/players/guest'));
        throw new Error('방 연결을 취소했습니다.');
      }
      await this.attach(code, side);
    }
    async attach(code, side) {
      this.code = code; this.side = side;
      this.ref = this.sdk.ref(this.sdk.db, 'arena/duels/' + code);
      this.playerRef = this.sdk.ref(this.sdk.db, 'arena/duels/' + code + '/players/' + side);
      this.listeners.push(this.sdk.onValue(this.ref, snapshot => { if (!this.closed) { this.room = snapshot.val(); this.loaded = true; this.onChange(); } }, () => { if (!this.closed) this.onError('방이 만료됐거나 접근할 수 없습니다. 로비에서 새 방을 만들어 주세요.'); }));
      this.listeners.push(this.sdk.onValue(this.sdk.ref(this.sdk.db, '.info/serverTimeOffset'), snapshot => { this.offset = snapshot.val() || 0; }));
      this.listeners.push(this.sdk.onValue(this.sdk.ref(this.sdk.db, '.info/connected'), snapshot => {
        this.connected = !!snapshot.val(); this.onChange();
        if (this.connected && !this.closed) void this.connectPresence().catch(() => this.onError('연결 상태를 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      }));
      try { sessionStorage.setItem('wax-ball-arena.friend-code', code); } catch {}
    }
    active() { return !document.hidden && !document.body.classList.contains('orientation-blocked'); }
    async connectPresence() {
      this.disconnect = this.sdk.onDisconnect(this.playerRef);
      await this.disconnect.update({ online: false, active: false, lastSeenAt: this.sdk.serverTimestamp() });
      if (!this.closed) await this.sdk.update(this.playerRef, { online: true, active: this.active(), lastSeenAt: this.sdk.serverTimestamp() });
    }
    async setActive() {
      if (this.playerRef && this.connected && !this.closed) await this.sdk.update(this.playerRef, { active: this.active() });
    }
    async ready() {
      if (!this.connected || !this.room || this.room.startedAt) return;
      await this.sdk.update(this.playerRef, { ready: !this.room.players[this.side].ready });
    }
    async start() {
      if (this.side !== 'host' || !this.room?.players.guest?.ready || !this.room.players.host.ready) return;
      await this.sdk.set(this.sdk.ref(this.sdk.db, 'arena/duels/' + this.code + '/startedAt'), this.sdk.serverTimestamp());
    }
    async hit() {
      const state = this.snapshot();
      if (state.stage !== 'playing' || !this.connected || this.hitting || !this.active()) return;
      this.hitting = true; this.onChange();
      try {
        await this.sdk.runTransaction(this.playerRef, current => {
          if (!current || current.clicks >= 500 || this.now() - current.lastHitAt < (current.clicks % 5 === 0 ? 165 : 65)) return;
          return { ...current, clicks: current.clicks + 1, lastHitAt: this.sdk.serverTimestamp() };
        }, { applyLocally: false });
      } catch { if (this.snapshot().stage === 'playing') this.onError('타격을 확인하지 못했습니다. 연결 상태를 확인해 주세요.'); }
      finally { this.hitting = false; this.onChange(); }
    }
    async claim() {
      if (!this.snapshot().canClaim) return;
      await this.sdk.set(this.sdk.ref(this.sdk.db, 'arena/duels/' + this.code + '/forfeit'), this.snapshot().opponent);
    }
    async leave() {
      this.closed = true;
      for (const stop of this.listeners) stop(); this.listeners = [];
      if (!this.ref) return;
      try {
        if (!this.connected) return;
        const ended = view(this.room, this.sdk.uid, this.now()).stage === 'ended';
        if (!this.room?.startedAt || ended) {
          if (this.side === 'host') await this.sdk.remove(this.ref);
          else if (!this.room?.startedAt) await this.sdk.remove(this.playerRef);
          else await this.sdk.update(this.playerRef, { online: false, active: false, lastSeenAt: this.sdk.serverTimestamp() });
        } else {
          await this.sdk.set(this.sdk.ref(this.sdk.db, 'arena/duels/' + this.code + '/forfeit'), this.side);
          await this.sdk.update(this.playerRef, { online: false, active: false, lastSeenAt: this.sdk.serverTimestamp() });
        }
        await this.disconnect?.cancel();
      } catch { /* Leave onDisconnect registered when cleanup cannot reach the server. */ }
    }
  }
  window.WaxArena.FriendRoom = FriendRoom;
  window.WaxArena.friendView = view;
})();
