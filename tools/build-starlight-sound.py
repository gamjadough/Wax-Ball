"""Build a quiet, short bell shimmer from Kenney's CC0 Impact Sounds."""
import argparse,array,hashlib,json,subprocess,sys,wave
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--ffmpeg',required=True);a=p.parse_args()
out=Path(__file__).resolve().parent.parent/'wakppuball/sounds/starlight';out.mkdir(parents=True,exist_ok=True)
raw=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(a.source),'-af','highpass=f=600,lowpass=f=3600,aecho=0.7:0.35:65|130:0.22|0.1,atrim=duration=0.62,afade=t=in:d=0.018,afade=t=out:st=0.20:d=0.42','-f','f32le','-ac','1','-ar','22050','pipe:1'])
x=array.array('f');x.frombytes(raw)
if sys.byteorder!='little':x.byteswap()
peak=max(map(abs,x));gain=.42/max(peak,.001)
pcm=array.array('h',(round(max(-1,min(1,v*gain))*32767) for v in x))
if sys.byteorder!='little':pcm.byteswap()
file=out/'chime.wav'
with wave.open(str(file),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(22050);f.writeframes(pcm.tobytes())
manifest={'author':'Kenney','license':'CC0-1.0','source_url':'https://kenney.nl/assets/impact-sounds','source':a.source.name,'source_sha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),'output':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'duration':len(x)/22050,'peak':.42,'processing':'600–3600 Hz, soft attack, two quiet echoes, fade-out; mono 22050 Hz PCM16'}
(out/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print('Built starlight/chime.wav:',len(x)/22050,'seconds; peak <= 0.42')
