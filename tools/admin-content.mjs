// Mirror the server's database role + signed-in session check.
export const adminContentAccess=actor=>actor?.role==='admin'&&!actor.is_anonymous;
export function unlockAdminBalls(actor,catalog){
 if(!adminContentAccess(actor))return;
 for(const key of ['unlocked_ball_ids','discovered_ball_ids'])actor.state[key]=[...new Set([...(actor.state[key]||[]),...catalog.map(b=>b.id)])];
}
