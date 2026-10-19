"""Original star shimmer: soft harmonic sine tones, without sampled metal/noise."""
import array,hashlib,json,math,sys,wave
from pathlib import Path
out=Path(__file__).resolve().parent.parent/'wakppuball/sounds/starlight';out.mkdir(parents=True,exist_ok=True)
sr=22050;duration=.9;notes=[(523.251,0,1),(783.991,.055,.55),(1046.502,.11,.25)]
def voice(t,f):
 if t<0:return 0
 # Slow onset removes impact; harmonic fifth/octave and quiet echoes add air.
 envelope=(1-math.exp(-t/.045))*math.exp(-t/.18)
 return envelope*(math.sin(2*math.pi*f*t)+.12*math.sin(2*math.pi*f*2*t))
x=[]
for i in range(round(sr*duration)):
 t=i/sr;v=sum(g*(voice(t-delay,f)+.18*voice(t-delay-.09,f)+.09*voice(t-delay-.18,f)) for f,delay,g in notes)
 v*=min(1,max(0,(duration-t)/.2));x.append(v)
peak=max(map(abs,x));x=[v*.36/peak for v in x];pcm=array.array('h',(round(v*32767) for v in x))
if sys.byteorder!='little':pcm.byteswap()
file=out/'shimmer-v2.wav'
with wave.open(str(file),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes(pcm.tobytes())
manifest={'author':'Wax-Ball project','license':'CC0-1.0','source':'Original procedural synthesis; no third-party recordings','generator':'tools/build-starlight-sound.py','output':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'duration':duration,'peak':.36,'processing':'Harmonic sine tones C5/G5/C6, 45ms soft attack, quiet echoes, fade-out; mono 22050 Hz PCM16'}
(out/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print('Built original shimmer:',duration,'seconds; peak <= 0.36')
