"""Original CC0 material foley: wax fracture transients + object-specific body/particles.
Deterministic 22.05 kHz mono WAV; no third-party recordings, no runtime DSP cost.
"""
from pathlib import Path
import hashlib,json,math,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'wakppuball/sounds/materials';OUT.mkdir(parents=True,exist_ok=True)
SR=22050
# id: texture, body Hz, fracture hardness, theme amount, coloration
PROFILES={
 'green':('wax',240,.55,.10,1.00),
 'strawberry':('fruit',190,.35,.37,.80),
 'apple':('fruit',340,.88,.21,1.16),
 'chocolate':('brittle',265,.92,.12,.84),
 'donut':('crumb',155,.24,.16,.70),
 'rainbow':('prism',420,.53,.11,1.14),
 'water':('water',165,.24,.61,.86),
 'emerald':('crystal',500,.83,.18,.86),
 'diamond':('crystal',760,.98,.23,1.26),
 'planet':('stone',108,.73,.19,.71),
 'sun':('fire',125,.79,.30,1.10),
 'blackhole':('void',64,.60,.35,.56),
 'whitehole':('light',240,.66,.28,1.30),
 'starlight':('light',365,.52,.22,1.12),
 'hellfire':('fire',98,.85,.44,.79),
 'heaven-cloud':('air',155,.25,.48,.90),
 'hell-ember':('ember',175,.92,.33,.67),
 'heaven-gem':('prism',610,.77,.25,.98),
 'hell-core':('core',52,.87,.33,.60),
 'judgment':('split',210,.91,.25,1.15),
 'heaven-earth':('orbit',116,.67,.31,.88),
 'soul':('soul',205,.40,.38,.78),
 'eternity':('ancient',82,.86,.25,.73),
}
PHASES=['early','mid','late','final']

def noise(rng,n,low,high):
 x=rng.normal(0,1,n);f=np.fft.rfftfreq(n,1/SR)
 mask=1/(1+(f/high)**6)
 if low:mask*=1-1/(1+(f/max(low,1))**6)
 y=np.fft.irfft(np.fft.rfft(x)*mask,n)
 return y/max(float(np.std(y)),.00001)

def render(ball,stage):
 kind,body,hard,amount,color=PROFILES[ball]
 rng=np.random.default_rng(int(hashlib.sha256(f'{ball}:{stage}'.encode()).hexdigest()[:16],16))
 duration=[.22,.31,.43,.94][stage]+(.10 if kind in ('void','soul','ancient','orbit') and stage==3 else 0)
 t=np.arange(round(SR*duration))/SR;y=np.zeros_like(t)
 def add(start,dur,gain,low=700,high=5000):
  offset=round(start*SR);length=min(round(dur*SR),len(y)-offset)
  if length<2:return
  z=np.arange(length)/SR;env=(1-np.exp(-z/.0007))*np.exp(-z/(dur/5))
  env*=np.minimum(1,(dur-z)/.006).clip(0,1)
  y[offset:offset+length]+=noise(rng,length,low,high)*env*gain
 def mode(start,hz,decay,gain,fall=0):
  z=np.maximum(t-start,0);env=(t>=start)*(1-np.exp(-z/.0015))*np.exp(-z/decay)
  y[:]+=gain*np.sin(2*np.pi*(hz*z+fall*z*z/2))*env
 # Immediate wax shell snap, low tactile impact and successive micro-fractures.
 add(0,.045,.24+.09*hard,650,2600+2400*hard)
 mode(0,body,.026+.012*stage,.25+stage*.025,-body*1.6)
 add(.001,.08,.12,60,550)
 count=[3,6,10,25][stage]
 span=[.055,.13,.22,.47][stage]
 for i in range(count):
  start=float(rng.uniform(.003,span));dur=float(rng.uniform(.009,.034))
  add(start,dur,float(rng.uniform(.055,.15))*(1-start/(duration+1)),800*color,(3200+2100*hard)*color)
 if stage>=1:add(.017,.07,.16+stage*.025,260,2100*color)
 if stage==3:
  add(.007,.25,.21,140,3400*color)
  mode(.008,max(42,body*.55),.085,.21)
 # Texture stays subordinate to the physical wax fracture.
 if kind in ('fruit','water'):
  add(.004,.13+.04*stage,amount,170,1350 if kind=='fruit' else 3300)
  for i in range([2,3,5,10][stage]):
   start=float(rng.uniform(.012,.11+.055*stage));hz=float(rng.uniform(190,740))*color
   mode(start,hz,.008 if kind=='fruit' else .018,amount*.17,hz*7)
 elif kind in ('brittle','crumb','stone','ancient'):
  # Dry chips and shorter/thicker body, never a ringing metal strike.
  for i in range(2+stage*3):
   add(float(rng.uniform(.02,span+.045)),.023,amount*.45,1300 if kind=='brittle' else 380,4500 if kind=='brittle' else 2500)
  mode(.005,body*1.47,.019 if kind=='crumb' else .047,amount*.45)
  if kind=='ancient' and stage>=2:mode(.025,53,.11,amount*.45)
 elif kind in ('crystal','prism'):
  for i,ratio in enumerate([1,1.41,2.13,2.78]):
   mode(.004+i*.009,(body*2.0)*ratio,.027+.015*stage,amount*.32/(1+i*.5))
  if stage==3:
   for i in range(8):mode(.07+i*.045,float(rng.uniform(1500,4300)),.024,amount*.10)
 elif kind in ('fire','ember'):
  add(.008,.15+.05*stage,amount*.43,850,4800*color)
  for i in range(5+stage*5):add(float(rng.uniform(.009,span+.03)),.008,amount*.4,1800,6200)
 elif kind in ('void','core'):
  mode(.002,body,.10+.022*stage,amount*.8,-body*.7)
  add(.015,.17+.08*stage,amount*.28,40,740)
  if kind=='void':add(.025,.14+.05*stage,amount*.12,600,1700)
 elif kind in ('light','air','soul','orbit'):
  add(.003,.15+.05*stage,amount*.33,850 if kind=='light' else 220,4500 if kind=='light' else 2100)
  if kind=='light':
   mode(.014,body*2.12,.041+.018*stage,amount*.20)
   mode(.027,body*3.19,.034+.012*stage,amount*.11)
  if kind=='soul':
   mode(.017,body*1.12,.055+.02*stage,amount*.23)
   mode(.026,body*1.48,.06,amount*.12)
  if kind=='orbit':
   mode(.009,body*1.8,.08,amount*.22)
   if stage>=2:add(.085,.1,amount*.14,350,1750)
 elif kind=='split':
  add(.012,.035,amount*.5,1300,5700)
  mode(.018,body*2.31,.038,amount*.27)
  if stage==3:add(.055,.12,amount*.7,650,4200)
 # Gentle diffusion on final fragments; no long musical tail.
 if stage==3:
  dry=y.copy()
  for delay,gain in [(.043,.11),(.079,.065),(.131,.035)]:
   d=round(delay*SR);y[d:]+=dry[:-d]*gain
 y-=float(np.mean(y));y*=np.minimum(t/.001,1)*np.minimum((duration-t)/.035,1).clip(0,1)
 # Consistent peaks, increasing transient weight as the shell fails.
 peak=float(np.max(np.abs(y)));y*=([.46,.49,.52,.59][stage]/max(peak,1e-9))
 pcm=np.round(y*32767).astype('<i2')
 return pcm,duration

outputs=[]
for ball in PROFILES:
 (OUT/ball).mkdir(exist_ok=True)
 for stage,name in enumerate(PHASES):
  pcm,duration=render(ball,stage);path=OUT/ball/(name+'.wav')
  with wave.open(str(path),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
  outputs.append({'file':f'{ball}/{name}.wav','seconds':len(pcm)/SR,'peak':round(float(np.max(np.abs(pcm.astype(float))))/32768,4),'rms':round(float(np.sqrt(np.mean((pcm.astype(float)/32768)**2))),4),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
config={ball:{**{phase:[f'materials/{ball}/{phase}.wav'] for phase in PHASES},'pitch':1,'pitchRandom':.025,'volume':.78,'volumeRandom':.035} for ball in PROFILES}
(ROOT/'wakppuball/js/material-sounds.js').write_text('// Generated by tools/build-material-sounds.py. Original CC0 material foley.\nwindow.WakppuMaterialSounds='+json.dumps(config,separators=(',',':'))+';\n',encoding='utf8')
(OUT/'sources.json').write_text(json.dumps({'license':'CC0-1.0','source':'Original deterministic noise grains, damped body modes and material-specific particles; no third-party samples.','generator':'tools/build-material-sounds.py','sample_rate':SR,'channels':1,'profiles':PROFILES,'outputs':outputs},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(OUT/'README.md').write_text('# Material foley\n\nOriginal audio dedicated to CC0-1.0. No third-party recordings.\n\nEach ball has early/mid/late/final stages: immediate wax shell transients, progressively denser fractures and a stronger collapse with short fragments. Fruit/water add fluid texture; gems add brief nonharmonic chips; space/transcendent balls add restrained pressure, air and body layers. These are synthesized foley, not live recordings.\n\n22,050 Hz, 16-bit mono. Peaks 0.46 / 0.49 / 0.52 / 0.59; final tail under 1.05 s. Generated deterministically by `tools/build-material-sounds.py` (NumPy). Only the selected ball is preloaded; audio cache is bounded. Existing yellow/event/seasonal/gem/skin audio is unchanged.\n',encoding='utf8')
print(f'Generated {len(outputs)} original WAVs for {len(PROFILES)} balls: {sum((OUT/o["file"]).stat().st_size for o in outputs):,} bytes')
