(() => {
 const selected=new URLSearchParams(location.search).get('server')==='friends'?'friends':'public';
 const friends={id:'friends',name:'친구 서버',url:'https://obkukmtuibymynvlunll.supabase.co',anonKey:null,game:'../wakppuball/',friendGate:window.WAKPPU_FRIENDS_CONFIG.friendGate===true};
 const publicServer={...window.WAKPPU_SERVER,name:'공개 서버',paidContent:false,game:'../wakppuball-public/'};
 // The friends config is loaded before this file, while the public config is
 // captured by the HTML before loading the friends config. Both are public keys.
 friends.anonKey=window.WAKPPU_FRIENDS_CONFIG.anonKey;
 const chosen=selected==='friends'?friends:publicServer;
 window.WAKPPU_SERVER=chosen;window.WAKPPU_ADMIN_SITE=true;
})();
