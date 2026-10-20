"""Original procedural sound design: dark pulse, dissonant chimes, collapsing resonance."""
from pathlib import Path
import math,random,struct,wave
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'wakppuball/sounds/admin';OUT.mkdir(parents=True,exist_ok=True)
SR=22050
for name,duration,stage in [('pulse',.32,0),('chime',.52,1),('fracture',.72,2),('collapse',1.65,3)]:
 rng=random.Random(910+stage);data=[]
 for i in range(round(duration*SR)):
  t=i/SR;p=t/duration;attack=min(1,t/.012);env=attack*(1-p)**2
  # Low falling body, nonharmonic bell partials and a restrained airy texture.
  body=math.sin(2*math.pi*(88*t-18*t*t))*math.exp(-t*6)
  bell=sum(math.sin(2*math.pi*f*t)*math.exp(-t*d) for f,d in [(196,3),(277.18,4),(415.3,5)])/3
  air=rng.uniform(-1,1)*.055*math.exp(-t*12)
  x=(.62*body+(.18+.09*stage)*bell+air)*env
  if stage==3:
   x+=.18*math.sin(2*math.pi*49*t)*attack*(1-p)**3
   for delay in [.14,.31,.53]:
    q=t-delay
    if q>0:x+=.075*math.sin(2*math.pi*207.65*q)*min(1,q/.02)*math.exp(-q*4)*(1-p)
  data.append(x)
 peak=max(map(abs,data));scale=.58/peak
 with wave.open(str(OUT/(name+'.wav')),'wb') as w:
  w.setparams((1,2,SR,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',round(x*scale*32767)) for x in data))
 print(name,duration,'peak=.58')
