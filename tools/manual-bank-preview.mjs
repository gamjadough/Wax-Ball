import {createHash} from 'node:crypto';
import {bankFixture} from './manual-bank-fixture.mjs';
import {itemState} from './items-service.mjs';
export async function createBankPreview(){
 const {db,add,rpc}=await bankFixture();let queue=Promise.resolve();const actors=new Map();
 // Fake bank details exist only in this explicit local preview, never migrations.
 await db.exec("update wakppu_purchase_config set enabled=true,bank_name='로컬 테스트 은행',account_number='000-0000-0000',account_holder='실제 입금 금지',support_contact='로컬 체험 전용 · 실제 송금하지 마세요' where id;");
 const idFor=actor=>{const h=createHash('sha256').update(actor.id).digest('hex');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20,32)].join('-');};
 async function mirror(actor){const id=idFor(actor),inv=itemState(actor);await add(id,actor.role,actor.role!=='admin'&&!actor.localAuth?.verified);await db.query('update game_states set gold=$2,item_revision=$3 where user_id=$1',[id,String(actor.state.gold),inv.revision]);await db.query('insert into wakppu_items(user_id,inventory) values($1,$2) on conflict(user_id) do update set inventory=$2',[id,JSON.stringify(inv.inventory)]);}
 async function deliver(actor){const id=idFor(actor),g=(await db.query('select gold::text,item_revision from game_states where user_id=$1',[id])).rows[0],i=(await db.query('select inventory from wakppu_items where user_id=$1',[id])).rows[0];actor.state.gold=g.gold;actor.state.item_revision=Number(g.item_revision);const inv=itemState(actor);inv.revision=Number(g.item_revision);inv.inventory=i.inventory;}
 return {execute(actor,body){queue=queue.catch(()=>{}).then(async()=>{
  const id=idFor(actor);actors.set(id,actor);await mirror(actor);let target=actor;
  if(body.order_id){const row=(await db.query('select user_id from wakppu_purchase_orders where id=$1',[body.order_id])).rows[0];target=actors.get(row?.user_id)||actor;if(target!==actor)await mirror(target);}
  await db.query('update players set nickname=$2,banned=$3 where user_id=$1',[id,actor.nickname,actor.moderation?.status==='banned']);
  const result=await rpc(id,body);await deliver(target);return result;
 });return queue;},async ownsSupporter(actor){await queue.catch(()=>{});return (await db.query("select exists(select 1 from wakppu_purchase_entitlements where user_id=$1 and product_id='supporter_pack') as owned",[idFor(actor)])).rows[0].owned;},async supporters(){await queue.catch(()=>{});return (await db.query("select p.nickname from players p join wakppu_purchase_entitlements e on e.user_id=p.user_id where e.product_id='supporter_pack'")).rows.map(r=>r.nickname);}};
}
