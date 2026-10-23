import {test} from 'node:test';import assert from 'node:assert/strict';import {deflateSync} from 'node:zlib';import {customFixture} from './custom-sql-fixture.mjs';import {imageFixture,PNG} from './custom-edge-fixture.mjs';import {normalizePng} from '../supabase/functions/custom-ball-image/image.mjs';
test('image service: actual PNG decode/re-encode, private owned assets, idempotent apply, stale/conflicting requests, deletion and owner isolation',async()=>{
 const {db,add,rpc}=await customFixture(),admin='00000000-0000-0000-0000-000000000001',u='00000000-0000-0000-0000-000000000002',v='00000000-0000-0000-0000-000000000003';
 try{
  await add(admin,'admin');await add(u);await add(v);const images=imageFixture(db,rpc);
  const call=async(user,body)=>{const response=await images.handle(user,body);return {status:response.status,data:await response.json()};};
  assert.equal((await call(null,{action:'health'})).data.private_storage,true);assert.equal((await call(null,{action:'status'})).status,401);
  await rpc(admin,{action:'admin_purchase_config',mode:'set',revision:0,enabled:true,bank_name:'테스트 은행',account_number:'000-00000',account_holder:'테스트',support_contact:'실제 송금 금지'});
  for(const user of [u,v]){const {order}=await rpc(user,{action:'purchase_order',product_id:'custom_ball_all',depositor:'샘플',request_id:crypto.randomUUID()});await rpc(admin,{action:'admin_purchase_approve',order_id:order.id,confirmed_amount:29000,deposit_reference:order.id});}
  const png=new PNG({width:512,height:512});png.data.fill(140);const source=PNG.sync.write(png,{colorType:6,bitDepth:8});const image='data:image/png;base64,'+source.toString('base64');
  const request={action:'save',mode:'save',target:'yellow',effect:'yellow',sound:'yellow',revision:0,request_id:crypto.randomUUID(),image};
  const result=await call(u,request);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.state.revision,1);assert.equal(images.files.size,1);
  const canonical=images.files.values().next().value;const decoded=PNG.sync.read(Buffer.from(canonical));assert.equal(decoded.width,512);assert.deepEqual(decoded.data,png.data);
  const retry=await call(u,request);assert.equal(retry.status,200);assert.equal(retry.data.state.revision,1);assert.equal(images.files.size,1);
  const other=await call(v,{...request,request_id:crypto.randomUUID(),image:undefined,asset_id:request.request_id});assert.equal(other.status,403);assert.equal(images.files.size,1);
  assert.equal((await call(u,{...request,request_id:crypto.randomUUID()})).status,409);assert.equal(images.files.size,1);
  assert.equal((await call(u,{...request,revision:1,request_id:crypto.randomUUID(),effect:'skin:transcendent'})).status,403);
  assert.equal((await call(u,{...request,revision:1,request_id:crypto.randomUUID(),image:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
  const bad=Buffer.from(source);bad[16]=1;assert.equal((await call(u,{...request,revision:1,request_id:crypto.randomUUID(),image:'data:image/png;base64,'+bad.toString('base64')})).status,400);
  const damaged=Buffer.from(source);damaged[damaged.length-1]^=1;await assert.rejects(normalizePng(new Uint8Array(damaged),PNG));
  const restored=await call(u,{action:'save',mode:'restore',target:'@all',revision:1,request_id:crypto.randomUUID()});assert.equal(restored.status,200);assert.equal(images.files.size,0);
  assert.equal((await call(u,{action:'status'})).data.state.revision,2);
 }finally{await db.close();}
});
test('PNG validation bounds decompression and rejects animation, dimensions and trailing payloads',async()=>{
 const png=PNG.sync.write(new PNG({width:512,height:512}),{colorType:6,bitDepth:8});
 await assert.rejects(normalizePng(new Uint8Array(Buffer.concat([png,Buffer.from('trailing')])),PNG));
 const crc=bytes=>{let c=0xffffffff;for(const byte of bytes){c^=byte;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const type=Buffer.from(name),header=Buffer.alloc(4),end=Buffer.alloc(4);header.writeUInt32BE(data.length);end.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([header,type,data,end]);};
 const bomb=Buffer.concat([png.subarray(0,33),chunk('IDAT',deflateSync(Buffer.alloc(512*(512*4+1)+1))),chunk('IEND',Buffer.alloc(0))]);await assert.rejects(normalizePng(new Uint8Array(bomb),PNG));
 const animated=Buffer.concat([png.subarray(0,33),chunk('acTL',Buffer.alloc(8)),png.subarray(33)]);await assert.rejects(normalizePng(new Uint8Array(animated),PNG));
 const metadata=Buffer.concat([png.subarray(0,33),chunk('tEXt',Buffer.from('comment\0private metadata')),png.subarray(33)]);const normalized=await normalizePng(new Uint8Array(metadata),PNG);assert.ok(!Buffer.from(normalized).includes(Buffer.from('private metadata')));
});
