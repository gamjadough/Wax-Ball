"""Native file inputs and actual PNG save: Edge/WebKit touch emulation, no production accounts."""
import os,sys,socket,subprocess,io,struct
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
def photo(width,height,format='PNG',color=(200,40,30)):
 b=io.BytesIO();Image.new('RGB',(width,height),color).save(b,format);return b.getvalue()
large=photo(6000,1000,'JPEG');png=photo(512,512);blue=photo(512,512,color=(20,50,220));webp=photo(700,900,'WEBP')
original=Image.new('RGB',(800,400),(200,40,30));original.paste((20,50,220),(400,0,800,400));exif=Image.Exif();exif[274]=6;buffer=io.BytesIO();original.save(buffer,'JPEG',exif=exif);rotated=buffer.getvalue()
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PAYMENTS='1',WAKPPU_LOCAL_BANK_PREVIEW='1',WAKPPU_LOCAL_CUSTOM_LIVE='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-21T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  for name,engine in [('Edge',p.chromium),('WebKit',p.webkit)]:
   browser=engine.launch(**({'channel':'msedge'} if name=='Edge' else {}),headless=True)
   for width,height,fallback in [(390,844,False),(844,390,True)]:
    ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
    if fallback:ctx.add_init_script('window.createImageBitmap=undefined')
    ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith(('data:','blob:')) else r.fulfill(status=200,body=''))
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base,wait_until='networkidle');page.evaluate("async password=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore();await WakppuCustomBall.open();}",password)
    page.evaluate("()=>{window.editSizes=[];const original=WakppuCustomImage.read;WakppuCustomImage.read=async(...args)=>{const canvas=await original(...args);editSizes.push([canvas.width,canvas.height]);return canvas;};}")
    def select(bytes_,mime='image/png',filename='photo.png'):
     page.locator('#customFile').set_input_files({'name':filename,'mimeType':mime,'buffer':bytes_});expect(page.locator('#customImageStatus')).to_contain_text('사진을 불러왔습니다');expect(page.locator('#customApply')).to_be_enabled()
    def pixel(x=256,y=256):return page.locator('#customCanvas').evaluate('(c,p)=>Array.from(c.getContext("2d").getImageData(p[0],p[1],1,1).data)',[x,y])
    select(large,'image/jpeg','camera.jpg');assert pixel()[0]>150
    assert page.evaluate('editSizes.every(([w,h])=>w<=2048&&h<=2048)')
    select(png,'','photo');assert pixel()[0]>150
    select(webp,'image/webp','photo.webp');assert pixel()[0]>150
    select(rotated,'image/jpeg','portrait.jpg');assert pixel(256,128)[0]>150 and pixel(256,384)[2]>150,'EXIF orientation'
    select(blue);assert pixel()[2]>180
    select(blue);assert page.locator('#customFile').input_value()==''
    if not fallback:
     page.evaluate("()=>{window.originalBitmap=createImageBitmap;window.createImageBitmap=()=>Promise.reject(new TypeError('unsupported image options'));}")
     select(png);assert pixel()[0]>150;page.evaluate('()=>{window.createImageBitmap=originalBitmap;}')
    saved=pixel();before=page.evaluate('WakppuItemGame.read().gold');page.locator('#customApply').click();expect(page.locator('#customStatus')).to_contain_text('저장했습니다');expect(page.locator('#customApply')).to_be_enabled()
    page.locator('#customClose').click();page.evaluate('WakppuCustomBall.open()');expect(page.locator('#customApply')).to_be_enabled();assert all(abs(a-b)<5 for a,b in zip(pixel(),saved));assert page.evaluate('WakppuItemGame.read().gold')==before
    page.locator('#customFile').scroll_into_view_if_needed();page.locator('#customFile').set_input_files({'name':'broken.png','mimeType':'image/png','buffer':b'broken'});expect(page.locator('#customImageStatus')).to_contain_text('읽을 수 없는')
    page.locator('#customFile').set_input_files({'name':'photo.heic','mimeType':'image/heic','buffer':b'\x00\x00\x00\x18ftypheic\x00\x00\x00\x00'});expect(page.locator('#customImageStatus')).to_contain_text('HEIC')
    huge=bytearray(png);huge[16:20]=struct.pack('>I',20000);page.locator('#customFile').set_input_files({'name':'huge.png','mimeType':'image/png','buffer':bytes(huge)});expect(page.locator('#customImageStatus')).to_contain_text('6,400만')
    select(png)
    page.evaluate("()=>{const original=WakppuCustomImage.read;WakppuCustomImage.read=async(...args)=>{await new Promise(r=>setTimeout(r,150));return original(...args);};}")
    page.locator('#customFile').set_input_files({'name':'slow.png','mimeType':'image/png','buffer':png});page.locator('#customClose').click();page.evaluate('WakppuCustomBall.open()');select(blue);page.wait_for_timeout(300);assert pixel()[2]>180
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    for id in ['customApply','customClose']:assert page.locator('#'+id).bounding_box()['height']>=44
    assert not errors,errors
    print(f'PASS {name} {width}x{height} fallback={fallback}: large/blank-MIME/WebP/EXIF, API fallback, save/reopen, invalid/HEIC/huge, repeat/cancel and touch layout',flush=True)
    ctx.close()
   browser.close()
finally:server.terminate();server.wait(timeout=10)
