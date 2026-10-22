import {Buffer} from 'node:buffer';
// The client sends only its cropped 512px PNG; decode and re-encode again at the server.
export async function normalizePng(bytes,PNG){
 const fail=()=>{throw Object.assign(new Error('512px PNG 이미지를 다시 선택·적용해주세요.'),{status:400});};
 if(!(bytes instanceof Uint8Array)||bytes.length<57||bytes.length>1200000)fail();
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),signature=[137,80,78,71,13,10,26,10];
 if(signature.some((b,i)=>bytes[i]!==b)||v.getUint32(8)!==13||String.fromCharCode(...bytes.slice(12,16))!=='IHDR'||v.getUint32(16)!==512||v.getUint32(20)!==512||bytes[24]!==8||bytes[25]!==6||bytes[26]!==0||bytes[27]!==0||bytes[28]!==0)fail();
 const idat=[];let at=8,chunks=0,ended=false;
 while(at<bytes.length){
  if(at+12>bytes.length||++chunks>128)fail();const n=v.getUint32(at),type=String.fromCharCode(...bytes.slice(at+4,at+8));if(n>1200000||at+n+12>bytes.length)fail();
  if(type==='IDAT')idat.push(bytes.slice(at+8,at+8+n));
  if(type==='acTL'||type==='fcTL'||type==='fdAT')fail();
  at+=n+12;if(type==='IEND'){if(n!==0||at!==bytes.length)fail();ended=true;break;}
 }
 if(!ended||!idat.length)fail();
 // Bound decompression before the decoder runs, including malicious deflate streams.
 const reader=new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate')).getReader();let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512*(512*4+1)){await reader.cancel();fail();}}}catch{fail();}
 if(size!==512*(512*4+1))fail();
 let image;try{image=PNG.sync.read(Buffer.from(bytes),{checkCRC:true});}catch{fail();}
 if(image.width!==512||image.height!==512||image.data.length!==512*512*4)fail();
 return new Uint8Array(PNG.sync.write(image,{colorType:6,bitDepth:8,deflateLevel:9}));
}
