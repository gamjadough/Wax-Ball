import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoPayments} from './payment-demo-service.mjs';
const user=id=>({id,nickname:'체험'+id,localAuth:{verified:'2026-10-19T00:00:00Z'},state:{gold:'1234',rebirths:3}});
test('mock orders: login/link required, authoritative amount, ownership, retry and one entitlement',()=>{
 const api=createDemoPayments(),a=user('a'),b=user('b');let n=0;const order=(product='supporter_pack',extra={})=>api.execute(a,{action:'order',product_id:product,request_id:'request_number_'+(++n),...extra}).order;
 assert.throws(()=>api.execute(null,{action:'catalog'}),{status:401});
 assert.throws(()=>api.execute({...a,localAuth:null},{action:'order'}),{status:403});
 assert.throws(()=>order('supporter_pack',{amount:1}));assert.throws(()=>order('unknown'));
 const before=structuredClone(a.state),o=order();assert.equal(o.amount,1100);
 assert.equal(order().id,o.id); // Concurrent requests for one pending product reuse its order.
 assert.equal(api.execute(a,{action:'order',product_id:o.product_id,request_id:'request_number_3'}).order.id,o.id);
 assert.throws(()=>api.execute(b,{action:'get',order_id:o.id}),{status:404});
 assert.throws(()=>api.execute(b,{action:'authorize',order_id:o.id,outcome:'success'}),{status:404});
 assert.throws(()=>api.execute(a,{action:'fulfill',order_id:o.id}),{status:409});
 api.execute(a,{action:'authorize',order_id:o.id,outcome:'success'});
 assert.equal(api.execute(a,{action:'get',order_id:o.id}).order.status,'paid');
 assert.equal(Object.keys(api.execute(a,{action:'catalog'}).owned).length,0);
 api.execute(a,{action:'fulfill',order_id:o.id});api.execute(a,{action:'fulfill',order_id:o.id});
 assert.equal(Object.keys(api.execute(a,{action:'catalog'}).owned).length,1);
 assert.throws(()=>order(),{status:409});assert.deepEqual(a.state,before);
 const skin=order('starlight_skin');assert.equal(skin.amount,3300);
 assert.throws(()=>api.execute(a,{action:'equip',equipped:true}),{status:403});
 api.execute(a,{action:'authorize',order_id:skin.id,outcome:'success'});api.execute(a,{action:'fulfill',order_id:skin.id});
 assert.equal(api.execute(a,{action:'equip',equipped:true}).equipped,true);
 const refunded=api.execute(a,{action:'refund',order_id:skin.id});assert.equal(refunded.equipped,false);assert.equal(refunded.owned.starlight_skin,undefined);
 assert.throws(()=>api.execute(a,{action:'fulfill',order_id:skin.id}),{status:409});
 const repurchase=order('starlight_skin');api.execute(a,{action:'authorize',order_id:repurchase.id,outcome:'success'});api.execute(a,{action:'fulfill',order_id:repurchase.id});
 assert.equal(api.execute(a,{action:'refund',order_id:skin.id}).owned.starlight_skin,repurchase.id);
});
test('cancel/failure/expiry never grant and request IDs cannot change product',()=>{
 let time=0;const api=createDemoPayments({now:()=>time}),a=user('a');
 for(const outcome of ['cancel','fail']){const {order}=api.execute(a,{action:'order',product_id:'supporter_pack',request_id:'test_request_'+outcome});api.execute(a,{action:'authorize',order_id:order.id,outcome});api.execute(a,{action:'authorize',order_id:order.id,outcome:'success'});assert.throws(()=>api.execute(a,{action:'fulfill',order_id:order.id}),{status:409});}
 const {order}=api.execute(a,{action:'order',product_id:'supporter_pack',request_id:'test_request_expired'});
 assert.throws(()=>api.execute(a,{action:'order',product_id:'starlight_skin',request_id:'test_request_expired'}),{status:409});
 time=1800001;assert.equal(api.execute(a,{action:'authorize',order_id:order.id,outcome:'success'}).order.status,'expired');
 assert.deepEqual(api.execute(a,{action:'catalog'}).owned,{});
});
