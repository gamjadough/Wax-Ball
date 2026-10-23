// Local-only decoding: validate before decode, keep a bounded editing canvas,
// and use an HTML image fallback when ImageBitmap is unavailable or rejects options.
(() => {
 const failure=text=>new Error(text),aborted=()=>new DOMException('사진 읽기가 취소되었습니다.','AbortError');
 function dimensions(bytes){
  const b=new Uint8Array(bytes),v=new DataView(bytes),word=(at,n)=>String.fromCharCode(...b.slice(at,at+n));
  if(b.length>=24&&[137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x)&&word(12,4)==='IHDR')return {type:'image/png',width:v.getUint32(16),height:v.getUint32(20)};
  if(b[0]===255&&b[1]===216){
   let p=2;while(p+4<=b.length){if(b[p++]!==255)break;while(b[p]===255)p++;const marker=b[p++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;
    const size=(b[p]<<8)|b[p+1];if(size<2||p+size>b.length)break;
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7)return {type:'image/jpeg',width:(b[p+5]<<8)|b[p+6],height:(b[p+3]<<8)|b[p+4]};p+=size;
   }
  }
  if(b.length>=30&&word(0,4)==='RIFF'&&word(8,4)==='WEBP'){
   const type=word(12,4),base={type:'image/webp'};
   if(type==='VP8X')return {...base,width:1+b[24]+(b[25]<<8)+(b[26]<<16),height:1+b[27]+(b[28]<<8)+(b[29]<<16)};
   if(type==='VP8L'&&b[20]===47){const n=v.getUint32(21,true);return {...base,width:1+(n&16383),height:1+((n>>>14)&16383)};}
   if(type==='VP8 '&&b[23]===157&&b[24]===1&&b[25]===42)return {...base,width:v.getUint16(26,true)&16383,height:v.getUint16(28,true)&16383};
  }
  if(word(4,4)==='ftyp')throw failure('HEIC·HEIF 사진은 JPG 또는 PNG로 변환한 뒤 선택해주세요.');
  throw failure('읽을 수 없는 사진입니다. PNG·JPG·WebP 파일을 다시 선택해주세요.');
 }
 function wait(promise,signal,late=()=>{}){
  return new Promise((resolve,reject)=>{
   let finished=false;const end=(fn,value)=>{if(finished)return false;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);fn(value);return true;};
   const cancel=()=>end(reject,aborted()),timer=setTimeout(()=>{const e=failure('사진을 읽는 시간이 너무 깁니다. 더 작은 JPG·PNG로 다시 시도해주세요.');e.name='TimeoutError';end(reject,e);},20000);
   signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
   Promise.resolve(promise).then(value=>{if(!end(resolve,value))late(value);},error=>end(reject,error));
  });
 }
 async function read(file,{signal}={}){
  if(!file||!file.size)throw failure('이미지 파일을 선택해주세요.');
  if(file.size>20*1024*1024)throw failure('20MB 이하 사진을 선택해주세요.');
  if(signal?.aborted)throw aborted();
  const header=await wait(file.slice(0,1024*1024).arrayBuffer(),signal),meta=dimensions(header);
  if(meta.width<32||meta.height<32||meta.width>16384||meta.height>16384||meta.width*meta.height>64000000)throw failure('가로·세로 32px 이상, 6,400만 화소 이하 사진을 선택해주세요.');
  const blob=new Blob([file],{type:meta.type});let source=null,objectUrl=null,htmlImage=null;
  try{
   if(typeof window.createImageBitmap==='function'){
    // Only set width: preserve the browser's EXIF orientation and aspect ratio.
    // Use the shorter raw edge so rotated photos also stay within the edit limit.
    const width=Math.max(1,Math.floor(Math.min(meta.width,meta.height)*Math.min(1,2048/Math.max(meta.width,meta.height))));
    try{source=await wait(window.createImageBitmap(blob,{imageOrientation:'from-image',resizeWidth:width,resizeQuality:'high'}),signal,image=>image.close());}
    catch(e){if(e.name==='AbortError'||e.name==='TimeoutError')throw e;}
   }
   if(!source){
    objectUrl=URL.createObjectURL(blob);htmlImage=new Image();
    source=await wait(new Promise((resolve,reject)=>{htmlImage.onload=()=>resolve(htmlImage);htmlImage.onerror=()=>reject(failure('사진을 읽지 못했습니다. 다른 JPG·PNG·WebP 사진을 선택해주세요.'));htmlImage.src=objectUrl;}),signal);
   }
   if(signal?.aborted)throw aborted();
   const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
   if(!width||!height||width*height>64000000)throw failure('사진 크기를 확인할 수 없습니다. 다른 사진을 선택해주세요.');
   const scale=Math.min(1,2048/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
   const context=canvas.getContext('2d');if(!context)throw failure('이미지 편집을 시작할 수 없습니다. 페이지를 새로고침해주세요.');
   context.drawImage(source,0,0,canvas.width,canvas.height);canvas.close=()=>{canvas.width=canvas.height=0;};return canvas;
  }finally{source?.close?.();if(htmlImage){htmlImage.onload=htmlImage.onerror=null;htmlImage.src='';}if(objectUrl)URL.revokeObjectURL(objectUrl);}
 }
 window.WakppuCustomImage={read};
})();
