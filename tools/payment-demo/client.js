export async function request(path,body){
 const session=JSON.parse(sessionStorage.getItem('wakppu-local-session')||'null');
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'모의 결제 요청 실패'),{status:response.status});return data;
}
export const payment=body=>request('/local/payments',body);
export const checkoutUrl=id=>'/local-payments/checkout.html?order='+encodeURIComponent(id);
