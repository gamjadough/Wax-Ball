import {createHash} from 'node:crypto';
import {bankFixture} from './manual-bank-fixture.mjs';
export async function createBankPreview(){
 const {db,add,rpc}=await bankFixture();let queue=Promise.resolve();
 // Fake bank details exist only in this explicit local preview, never migrations.
 await db.exec("update wakppu_purchase_config set enabled=true,bank_name='로컬 테스트 은행',account_number='000-0000-0000',account_holder='실제 입금 금지',support_contact='로컬 체험 전용 · 실제 송금하지 마세요' where id;");
 const idFor=actor=>{const h=createHash('sha256').update(actor.id).digest('hex');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20,32)].join('-');};
 return {execute(actor,body){queue=queue.catch(()=>{}).then(async()=>{
  const id=idFor(actor);await add(id,actor.role,actor.role!=='admin'&&!actor.localAuth?.verified);
  await db.query('update players set nickname=$2,banned=$3 where user_id=$1',[id,actor.nickname,actor.moderation?.status==='banned']);
  return rpc(id,body);
 });return queue;},async supporters(){await queue.catch(()=>{});return (await db.query("select p.nickname from players p join wakppu_purchase_entitlements e on e.user_id=p.user_id where e.product_id='supporter_pack'")).rows.map(r=>r.nickname);}};
}
