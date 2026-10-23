// Only injected by the explicitly enabled loopback preview. No credentials required.
document.addEventListener('DOMContentLoaded',async()=>{
 const note=document.createElement('p');note.className='profile-preview-note';note.textContent='로컬 샘플 5명 · 온라인 3명 / 오프라인 2명 · 카드 전체를 눌러 프로필 보기';document.getElementById('rankingList').before(note);
 const session=await WakppuAuth.session();if(!session.data.session)await WakppuAuth.signIn('guest','');
 await WakppuItemGame.restore();await WakppuProfiles.refresh();
 document.getElementById('rankingBtn').click();
});
