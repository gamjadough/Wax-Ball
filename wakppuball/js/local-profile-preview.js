// Only injected by the explicitly enabled loopback preview. No credentials required.
document.addEventListener('DOMContentLoaded',async()=>{
 const session=await WakppuAuth.session();if(!session.data.session)await WakppuAuth.signIn('guest','');
 await WakppuItemGame.restore();await WakppuProfiles.refresh();
 document.getElementById('rankingBtn').click();
});
