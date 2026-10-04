import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': 'https://gamjadough.github.io',
  'Content-Type': 'application/json; charset=utf-8',
};

const balls = [
  { id: 'yellow', price: 0, clicks: 5, reward: 1 },
  { id: 'green', price: 10, clicks: 8, reward: 10 },
  { id: 'strawberry', price: 100, clicks: 11, reward: 30 },
  { id: 'apple', price: 250, clicks: 14, reward: 50 },
  { id: 'chocolate', price: 500, clicks: 17, reward: 100 },
  { id: 'donut', price: 1500, clicks: 20, reward: 250 },
  { id: 'rainbow', price: 2500, clicks: 23, reward: 400 },
  { id: 'water', price: 7000, clicks: 26, reward: 1000 },
  { id: 'emerald', price: 10000, clicks: 29, reward: 1500 },
  { id: 'diamond', price: 15000, clicks: 32, reward: 2000 },
  { id: 'planet', price: 100000, clicks: 50, reward: 10000 },
  { id: 'sun', price: 5000000, clicks: 100, reward: 500000 },
  { id: 'blackhole', price: 50000000, clicks: 180, reward: 5000000 },
] as const;
const rebirthCosts = [500000, 1500000, 4000000, 10000000, 25000000, 60000000, 150000000, 400000000, 1000000000, 2500000000, 7500000000, 20000000000, 50000000000, 125000000000, 300000000000, 750000000000, 2000000000000, 5000000000000, 12000000000000, 30000000000000, 75000000000000, 200000000000000, 500000000000000, 1200000000000000, 3000000000000000];
const ballById = new Map(balls.map((ball, index) => [ball.id, { ...ball, index }]));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const fail = (message: string, status = 400) => json({ error: message }, status);
const list = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const multiplier = (rebirths: number) => 2 ** rebirths;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return fail('POST only', 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== 'https://gamjadough.github.io' && !origin.startsWith('http://localhost:')) return fail('origin not allowed', 403);

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return fail('login required', 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return fail('invalid session', 401);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') return fail('invalid request');
  const action = body.action;
  const now = new Date();

  const { data: player } = await admin.from('players').select('*').eq('user_id', user.id).single();
  const { data: state } = await admin.from('game_states').select('*').eq('user_id', user.id).single();
  const { data: moderation } = await admin.from('moderation_cases').select('*').eq('user_id', user.id).single();
  if (!player || !state || !moderation) return fail('player initialization incomplete', 409);

  if (action === 'bootstrap') return json({ player: { id: user.id, nickname: player.nickname, role: player.role }, state, moderation: { status: moderation.status, suspended_until: moderation.suspended_until } });

  if (action === 'set_nickname') {
    const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
    if (!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(nickname)) return fail('nickname must be 2-16 Korean, English, number, or underscore characters');
    const { error } = await admin.from('players').update({ nickname, updated_at: now.toISOString() }).eq('user_id', user.id);
    if (error) return fail('nickname is already in use', 409);
    return json({ nickname });
  }

  if (action === 'rankings') {
    const { data, error } = await admin.from('game_states').select('gold, rebirths, players!inner(nickname)').order('rebirths', { ascending: false }).order('gold', { ascending: false }).limit(100);
    if (error) return fail('ranking unavailable', 500);
    return json((data ?? []).map((row: any) => ({ nickname: row.players.nickname, gold: Number(row.gold), rebirths: row.rebirths })));
  }

  const isSuspended = moderation.status === 'suspended' && moderation.suspended_until && new Date(moderation.suspended_until) > now;
  if (isSuspended) return fail('account suspended', 403);

  if (action === 'hit') {
    const ball = ballById.get(state.current_ball_id);
    if (!ball) return fail('invalid current ball', 409);
    const { data: prior } = await admin.from('click_events').select('received_at').eq('user_id', user.id).order('received_at', { ascending: false }).limit(40);
    const last = prior?.[0]?.received_at ? new Date(prior[0].received_at) : null;
    const interval = last ? now.getTime() - last.getTime() : null;
    const tooFast = interval !== null && interval < 45;
    const intervals = (prior ?? []).slice(0, 39).map((row: any, index: number) => new Date(row.received_at).getTime() - new Date(prior![index + 1].received_at).getTime());
    const average = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : 0;
    const deviation = intervals.length ? Math.sqrt(intervals.reduce((sum, value) => sum + (value - average) ** 2, 0) / intervals.length) / average : 1;
    const scoreDelta = (tooFast ? 2 : 0) + (intervals.length >= 30 && average <= 110 ? 2 : 0) + (intervals.length >= 39 && average >= 80 && average <= 500 && deviation < 0.04 ? 3 : 0);
    const nextScore = Math.max(0, Number(moderation.suspicion_score) + scoreDelta);
    const suspended = nextScore >= 16;
    await admin.from('click_events').insert({ user_id: user.id, ball_id: ball.id, interval_ms: interval, accepted: !tooFast, reason: tooFast ? 'minimum interval' : scoreDelta ? 'suspicious pattern' : null });
    await admin.from('moderation_cases').update({ suspicion_score: nextScore, status: suspended ? 'suspended' : nextScore >= 8 ? 'review' : 'active', suspended_until: suspended ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() : null, last_reason: suspended ? 'automated click pattern' : moderation.last_reason, updated_at: now.toISOString() }).eq('user_id', user.id);
    if (tooFast || suspended) return fail(suspended ? 'account suspended for review' : 'click rate limited', 429);
    const clicks = Number(state.current_clicks) + 1;
    if (clicks < ball.clicks) {
      await admin.from('game_states').update({ current_clicks: clicks, updated_at: now.toISOString() }).eq('user_id', user.id);
      return json({ broken: false, clicks, required: ball.clicks });
    }
    const honey = state.honey_expires_at && new Date(state.honey_expires_at) > now ? 2 : 1;
    const reward = ball.reward * multiplier(Number(state.rebirths)) * honey;
    const gold = Number(state.gold) + reward;
    await admin.from('game_states').update({ gold, current_clicks: 0, updated_at: now.toISOString() }).eq('user_id', user.id);
    return json({ broken: true, reward, gold, rebirths: state.rebirths, multiplier: multiplier(Number(state.rebirths)) * honey });
  }

  if (action === 'unlock') {
    const ballId = typeof body.ball_id === 'string' ? body.ball_id : '';
    const ball = ballById.get(ballId);
    const unlocked = list(state.unlocked_ball_ids);
    if (!ball || ball.index !== unlocked.length || Number(state.gold) < ball.price) return fail('unlock unavailable', 409);
    const nextUnlocked = [...unlocked, ball.id];
    const discovered = Array.from(new Set([...list(state.discovered_ball_ids), ball.id]));
    const gold = Number(state.gold) - ball.price;
    await admin.from('game_states').update({ gold, unlocked_ball_ids: nextUnlocked, discovered_ball_ids: discovered, selected_ball_id: ball.id, current_ball_id: ball.id, current_clicks: 0, updated_at: now.toISOString() }).eq('user_id', user.id);
    return json({ gold, unlocked_ball_ids: nextUnlocked, selected_ball_id: ball.id });
  }

  if (action === 'rebirth') {
    const rebirths = Number(state.rebirths);
    const cost = rebirthCosts[rebirths];
    if (cost === undefined || Number(state.gold) < cost) return fail('rebirth unavailable', 409);
    await admin.from('game_states').update({ gold: 0, rebirths: rebirths + 1, unlocked_ball_ids: ['yellow'], selected_ball_id: 'yellow', current_ball_id: 'yellow', current_clicks: 0, honey_expires_at: null, updated_at: now.toISOString() }).eq('user_id', user.id);
    return json({ gold: 0, rebirths: rebirths + 1, multiplier: multiplier(rebirths + 1) });
  }

  if (action === 'admin_unban') {
    if (player.role !== 'admin') return fail('admin only', 403);
    const targetId = typeof body.user_id === 'string' ? body.user_id : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
    if (!targetId || !reason) return fail('user_id and reason are required');
    await admin.from('moderation_cases').update({ status: 'active', suspicion_score: 0, suspended_until: null, last_reason: 'manually cleared', updated_at: now.toISOString() }).eq('user_id', targetId);
    await admin.from('admin_audit_logs').insert({ admin_user_id: user.id, target_user_id: targetId, action: 'unban', reason, details: { previous_status: 'suspended' } });
    return json({ ok: true });
  }
  return fail('unknown action', 404);
});
