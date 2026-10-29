"""Original procedural crystal/wax chimes. CC0-1.0; no samples or external audio."""
import array,hashlib,json,math,sys,wave
from pathlib import Path
out=Path(__file__).resolve().parent.parent/'wakppuball/sounds/blue-crystal'
out.mkdir(parents=True,exist_ok=True)
sr=22050;outputs=[]
for name,duration,notes in [
 ('tap',.22,[(980,0,1),(1470,.012,.35)]),
 ('crack',.34,[(740,0,.8),(1220,.025,.7),(1960,.06,.3)]),
 ('split',.46,[(520,0,.8),(1040,.018,.55),(1560,.07,.45),(2260,.12,.2)]),
 ('break',.95,[(190,0,1),(570,.02,.7),(1140,.055,.55),(1710,.13,.4),(2280,.23,.22)])]:
 samples=[]
 for i in range(round(sr*duration)):
  t=i/sr;v=0
  for hz,delay,gain in notes:
   z=t-delay
   if z>=0:
    env=(1-math.exp(-z/.004))*math.exp(-z/(.065 if name=='tap' else .19))
    v+=gain*env*(math.sin(2*math.pi*hz*z)+.22*math.sin(2*math.pi*hz*2.01*z))
  samples.append(v*min(1,max(0,(duration-t)/.07)))
 peak=max(map(abs,samples));samples=[v*.48/peak for v in samples]
 pcm=array.array('h',(round(v*32767) for v in samples))
 if sys.byteorder!='little':pcm.byteswap()
 target=out/(name+'.wav')
 with wave.open(str(target),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes(pcm.tobytes())
 outputs.append({'file':target.name,'duration':duration,'peak':.48,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
(out/'sources.json').write_text(json.dumps({'license':'CC0-1.0','source':'Original mathematical synthesis; no third-party recordings','generator':'tools/build-blue-crystal-sounds.py','outputs':outputs},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Generated 4 original CC0 crystal/wax sounds')
