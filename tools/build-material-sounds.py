"""CC0 material-specific foley v2. Different source recordings and temporal recipes;
there is deliberately NO shared wax/noise/impact bed and NO pitch shifting.
Build: python tools/build-material-sounds.py --ffmpeg /path/to/ffmpeg
"""
from pathlib import Path
import argparse,hashlib,json,shutil,subprocess,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1];SR=22050
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=ROOT/'tools/audio-sources/materials');p.add_argument('--ffmpeg',default=shutil.which('ffmpeg'));a=p.parse_args()
if not a.ffmpeg:p.error('--ffmpeg is required when ffmpeg is not on PATH')
OUT=ROOT/'wakppuball/sounds/materials';ARCHIVE=ROOT/'tools/audio-sources/materials';OUT.mkdir(parents=True,exist_ok=True)
I=lambda s:'impact/'+s;S=lambda s:'scifi/'+s
# Main source, secondary source, durations and construction differ by object.
PROFILES={
 'green':('soft',I('impactPunch_medium_002'),I('impactSoft_heavy_002'),[.16,.23,.31,.63],'dense yielding wax: dull knock, short splits, soft collapse'),
 'strawberry':('pulp',S('slime_000'),I('footstep_grass_003'),[.19,.27,.36,.67],'wet pulp squash, tiny seeds and sticky rupture'),
 'apple':('bite',I('footstep_grass_001'),I('impactWood_medium_003'),[.13,.20,.29,.56],'dry crisp bite followed by juicy coarse crunch'),
 'chocolate':('snap',I('impactWood_light_004'),I('impactPlank_medium_003'),[.12,.18,.25,.49],'clean brittle snap, separate small hard fragments, no ringing'),
 'donut':('crumb',I('footstep_carpet_001'),I('footstep_snow_000'),[.17,.24,.32,.58],'soft compression, papery crust and loose crumbs'),
 'rainbow':('cascade',I('impactBell_heavy_004'),I('impactGlass_light_000'),[.25,.34,.45,.93],'ascending playful glass cascade, no heavy thud'),
 'water':('liquid',S('slime_001'),None,[.23,.33,.45,.86],'rounded water plop, gurgling bubbles and wide splash'),
 'emerald':('mineral',I('impactMining_002'),I('impactGlass_medium_002'),[.17,.27,.39,.77],'compact gritty mineral chips and dark crystal cleavage'),
 'diamond':('shatter',I('impactGlass_medium_004'),I('impactGlass_heavy_003'),[.15,.25,.39,.89],'hard glass tick, sharp splitting sheet and falling shards'),
 'planet':('rubble',I('footstep_concrete_002'),I('impactMining_004'),[.23,.34,.47,1.02],'heavy rocky body, rough moving gravel and falling rubble'),
 'sun':('corona',S('thrusterFire_002'),S('explosionCrunch_001'),[.21,.31,.43,.91],'hot hiss and solar flare that expands outward'),
 'blackhole':('suction',S('spaceEngineLow_004'),None,[.28,.39,.49,1.04],'inward suction, low pressure dip and swallowed implosion'),
 'whitehole':('radiance',S('forceField_004'),None,[.25,.35,.47,1.00],'outward white-air burst and bright dispersing pressure'),
 'starlight':('twinkle',I('impactBell_heavy_001'),None,[.27,.37,.48,1.03],'delicate distant star twinkles with a soft airy release'),
 'hellfire':('roar',S('thrusterFire_000'),S('explosionCrunch_004'),[.23,.32,.46,.98],'rough sustained fire roar and burning rupture'),
 'heaven-cloud':('puff',I('footstep_carpet_003'),None,[.24,.33,.44,.90],'pillowy air puff and fluttering gust, no hard crack'),
 'hell-ember':('embers',S('thrusterFire_004'),I('impactMining_000'),[.16,.25,.36,.75],'separate dry spark pops and scattering small embers'),
 'heaven-gem':('celestial',I('impactGlass_medium_000'),I('impactBell_heavy_000'),[.23,.34,.46,1.01],'soft crystalline resonance, clear facets and calm ringing fragments'),
 'hell-core':('detonate',S('lowFrequency_explosion_001'),None,[.24,.35,.48,1.04],'dense two-pulse core detonation and deep pressure tail'),
 'judgment':('verdict',I('impactMetal_heavy_003'),I('impactGlass_light_001'),[.20,.30,.43,.97],'two contrasting strokes: heavy verdict then bright splitting seal'),
 'heaven-earth':('vortex',S('forceField_002'),I('impactMining_001'),[.26,.37,.48,1.04],'rotating air vortex followed by earth fragments'),
 'soul':('breath',S('forceField_003'),None,[.28,.39,.49,1.04],'hollow breathing ripple and fading ghost-like echoes'),
 'eternity':('fault',I('impactWood_heavy_000'),S('engineCircular_004'),[.24,.35,.48,1.04],'long dry fault creak, staggered fractures and ancient room decay'),
}
cache={};used={}
def decode(key):
 if key in cache:return cache[key]
 file=a.source/(key+'.ogg');raw=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(file),'-f','f32le','-ac','1','-ar',str(SR),'pipe:1'])
 x=np.frombuffer(raw,dtype='<f4').astype(float);nz=np.flatnonzero(np.abs(x)>max(.001,float(np.max(np.abs(x)))*.025))
 if len(nz):x=x[max(0,int(nz[0]) -33):]
 x-=np.mean(x);x/=max(float(np.max(np.abs(x))),1e-6)
 cache[key]=x;used[key]={'file':key+'.ogg','sha256':hashlib.sha256(file.read_bytes()).hexdigest()};return x

def filtered(x,lo=0,hi=0):
 if not lo and not hi:return x.copy()
 f=np.fft.rfftfreq(len(x),1/SR);g=np.ones_like(f)
 if hi:g/=1+(f/hi)**8
 if lo:g*=1-1/(1+(f/lo)**6)
 return np.fft.irfft(np.fft.rfft(x)*g,len(x))

def render(ball,stage):
 kind,main,secondary,durations,description=PROFILES[ball];duration=durations[stage]
 rng=np.random.default_rng(int(hashlib.sha256(f'foley-v2:{ball}:{stage}'.encode()).hexdigest()[:16],16))
 t=np.arange(round(SR*duration))/SR;y=np.zeros(len(t));strength=[.30,.52,.76,1][stage]
 def source(key,start=0,gain=1,limit=None,reverse=False,lo=0,hi=0,offset=0):
  if key is None:return
  x=decode(key);x=x[round(offset*SR):];x=x[::-1] if reverse else x
  if limit is not None:x=x[:max(2,round(limit*SR))]
  if not len(x):return
  x=filtered(x,lo,hi);n=min(len(x),len(y)-round(start*SR))
  if n<2:return
  env=np.minimum(np.arange(n)/(SR*.0015),1)*np.minimum(np.arange(n,0,-1)/(SR*.012),1)
  j=round(start*SR);y[j:j+n]+=x[:n]*env*gain
 def air(start,dur,gain,lo,hi,attack=.006,pulse=0):
  j=round(start*SR);n=min(round(dur*SR),len(y)-j)
  if n<2:return
  z=np.arange(n)/SR;x=filtered(rng.normal(0,1,n),lo,hi);x/=max(float(np.std(x)),1e-6)
  env=(1-np.exp(-z/attack))*np.exp(-z/(dur*.33))
  if pulse:env*=.55+.45*np.sin(2*np.pi*pulse*z)**2
  y[j:j+n]+=x*env*gain
 def tone(start,hz,dur,gain,sweep=0):
  z=np.maximum(t-start,0);env=(t>=start)*(1-np.exp(-z/.003))*np.exp(-z/dur)
  y[:]+=np.sin(2*np.pi*(hz*z+sweep*z*z*.5))*env*gain
 if kind=='soft':
  source(main,limit=[.085,.12,.16,.22][stage],gain=.9,hi=2700)
  source(secondary,.018,.32*strength,limit=.07+.04*stage,hi=3800)
  if stage==3:source(secondary,.105,.22,limit=.14,hi=2600)
 elif kind=='pulp':
  source(main,limit=.12+.08*stage,gain=.95,hi=3600)
  source(secondary,.012,.35*strength,limit=.06+.035*stage,lo=500)
  for i in range(1+stage*2):tone(.025+i*.027,280+float(rng.uniform(0,320)),.008,.06,sweep=5500)
 elif kind=='bite':
  source(main,limit=.07+.035*stage,gain=.8,lo=700,hi=6400)
  source(secondary,.004,.65,limit=.045+.016*stage,hi=4300)
  if stage==3:
   source(main,.065,.42,limit=.13,lo=900,offset=.02);source(secondary,.13,.2,limit=.065)
 elif kind=='snap':
  source(main,limit=.045+.018*stage,gain=1,lo=300,hi=4300)
  for i in range(1+stage*2):source(secondary,.013+i*(.018+stage*.005),.44/(1+i*.19),limit=.027+.004*stage,lo=900,hi=4700,offset=float(rng.uniform(0,.012)))
 elif kind=='crumb':
  source(main,limit=.09+.04*stage,gain=1.2,hi=1350)
  source(secondary,.018,.68*strength,limit=.09+.05*stage,lo=800,hi=4400)
  if stage==3:source(secondary,.18,.20,limit=.18,lo=1300)
 elif kind=='cascade':
  source(secondary,gain=.22,limit=.035,lo=1500)
  for i in range(2+stage*2):
   source(main,.012+i*.045,.22/(1+i*.22),limit=.08,hi=4000,offset=i*.006)
   tone(.012+i*.045,[523.25,659.25,783.99,1046.5][i%4],.037,.05)
 elif kind=='liquid':
  source(main,limit=.09+.06*stage,gain=.33,hi=1700)
  for i in range(3+stage*3):
   z=float(rng.uniform(0,.04+.11*stage));hz=float(rng.uniform(120,460));tone(z,hz,.018+.006*stage,.19/(1+i*.11),sweep=hz*9)
  air(.012,.13+.12*stage,.055+stage*.022,900,5000,attack=.018)
 elif kind=='mineral':
  source(main,limit=.09+.035*stage,gain=1,hi=3900)
  for i in range(1+stage*2):source(secondary,.025+i*.029,.34/(1+i*.16),limit=.08,lo=1100,hi=4900)
 elif kind=='shatter':
  source(main,limit=.06+.045*stage,gain=.7,lo=900)
  if stage:source(secondary,.008,.30+stage*.21,limit=.11+.13*stage,lo=1000)
  if stage==3:
   for i in range(5):source(main,.15+i*.065,.13/(1+i*.25),limit=.055,lo=1900,offset=.045+i*.013)
 elif kind=='rubble':
  source(main,limit=.1+.055*stage,gain=1,hi=1300)
  for i in range(1+stage*3):source(secondary,.014+i*.032,.48/(1+i*.13),limit=.075,lo=180,hi=3700,offset=i*.009)
 elif kind=='corona':
  source(main,limit=.09+.09*stage,gain=.8,lo=650,hi=5600)
  source(secondary,.008,.27+stage*.16,limit=.09+.09*stage,hi=5300)
  air(.015,.12+.10*stage,.07,1900,6800)
 elif kind=='suction':
  source(main,limit=.1+.11*stage,gain=.8,reverse=True,hi=1250)
  tone(0,105,.03,.19,sweep=-800);tone(.035,58,.09+stage*.03,.15)
  air(.015,.13+stage*.09,.055,180,1300,attack=.028)
  if stage==3:
   # The pressure vanishes into a small dull implosion instead of an outward bang.
   y[t<.18]*=np.linspace(.35,1,np.count_nonzero(t<.18));tone(.185,76,.04,.27,sweep=-240)
 elif kind=='radiance':
  source(main,limit=.09+.10*stage,gain=.55,lo=550,hi=4100)
  air(0,.14+.11*stage,.12,1100,6500,attack=.002)
  tone(.012,920,.055,.055);tone(.025,1380,.045,.035)
  if stage==3:air(.21,.43,.07,1800,5900,attack=.025)
 elif kind=='twinkle':
  for i in range(2+stage):
   source(main,.009+i*.082,.19/(1+i*.22),limit=.09,lo=1100,hi=5200,offset=i*.005)
   tone(.008+i*.082,[880,1318.5,1760,2217.5,2637][i],.055,.045/(1+i*.3))
  air(0,.17+.09*stage,.02,2300,6200,attack=.018)
 elif kind=='roar':
  source(main,limit=.15+.12*stage,gain=.95,hi=4200)
  source(secondary,.008,.35+.13*stage,limit=.12+.09*stage,hi=3500)
  y[:]=np.tanh(y*2)*.7
 elif kind=='puff':
  source(main,limit=.08+.035*stage,gain=.33,hi=900)
  air(0,.16+.13*stage,.18,200,2600,attack=.012,pulse=13)
  if stage==3:air(.19,.42,.08,700,3100,attack=.03,pulse=7)
 elif kind=='embers':
  for i in range(2+stage*4):
   start=0 if i==0 else float(rng.uniform(.025,.06+.12*stage))
   source(main,start,.42/(1+i*.065),limit=.014+float(rng.uniform(0,.011)),lo=1600,hi=6800,offset=float(rng.uniform(0,.12)))
  source(secondary,.005,.18,limit=.025,lo=1100,hi=5200)
 elif kind=='celestial':
  source(main,limit=.10+.065*stage,gain=.7,hi=4800)
  source(secondary,.027,.16+stage*.035,limit=.16+.10*stage,lo=1300,hi=4400)
  if stage==3:
   source(main,.18,.23,limit=.18,lo=1800,reverse=True);tone(.03,1174.66,.17,.055)
 elif kind=='detonate':
  source(main,limit=.13+.13*stage,gain=.8,hi=2200)
  if stage>=1:source(main,.065+stage*.013,.34,limit=.1+.07*stage,hi=900,offset=.02)
  tone(.004,48,.09+stage*.035,.25)
 elif kind=='verdict':
  source(main,limit=.08+.035*stage,gain=.62,hi=3400)
  source(secondary,.045+.012*stage,.60,limit=.07+.08*stage,lo=1700)
  if stage==3:source(main,.15,.27,limit=.09,hi=1800)
 elif kind=='vortex':
  source(main,limit=.11+.11*stage,gain=.48,reverse=True,lo=180,hi=2200)
  air(0,.17+.12*stage,.075,300,1800,attack=.008,pulse=9)
  source(secondary,.055,.42*strength,limit=.07+.06*stage,hi=3000)
 elif kind=='breath':
  source(main,limit=.13+.12*stage,gain=.6,reverse=True,lo=270,hi=1600)
  tone(.008,233.08,.08+stage*.025,.06);tone(.018,349.23,.07+stage*.02,.04)
  air(.005,.16+.11*stage,.035,350,1900,attack=.035,pulse=5)
  if stage==3:
   dry=y.copy();j=round(.165*SR);y[j:]+=dry[:-j]*.3
 elif kind=='fault':
  source(main,limit=.10+.04*stage,gain=.65,hi=2100)
  source(secondary,.014,.23,limit=.11+.11*stage,hi=900)
  for i in range(stage*2):source(main,.045+i*.067,.37/(1+i*.15),limit=.052,lo=250,hi=2700,offset=.035+i*.006)
  if stage==3:tone(.055,69.3,.18,.12)
 y-=float(np.mean(y));y*=np.minimum(t/.0015,1)*np.minimum((duration-t)/.03,1).clip(0,1)
 peak=float(np.max(np.abs(y)));assert peak>.0001,ball;y*=([.46,.49,.52,.59][stage]/peak)
 return np.round(y*32767).astype('<i2')

outputs=[]
for ball in PROFILES:
 (OUT/ball).mkdir(exist_ok=True)
 for stage,name in enumerate(['early','mid','late','final']):
  pcm=render(ball,stage);path=OUT/ball/(name+'.wav')
  with wave.open(str(path),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
  outputs.append({'file':f'{ball}/{name}.wav','seconds':len(pcm)/SR,'peak':round(float(np.max(np.abs(pcm.astype(float))))/32768,4),'rms':round(float(np.sqrt(np.mean((pcm.astype(float)/32768)**2))),4),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
for key in used:
 src=a.source/(key+'.ogg');dest=ARCHIVE/(key+'.ogg');dest.parent.mkdir(parents=True,exist_ok=True)
 if src.resolve()!=dest.resolve():shutil.copyfile(src,dest)
for pack in ['impact','scifi']:
 src=a.source/pack/'License.txt';dest=ARCHIVE/pack/'License.txt';dest.parent.mkdir(parents=True,exist_ok=True)
 if src.resolve()!=dest.resolve():shutil.copyfile(src,dest)
 shutil.copyfile(src,OUT/(pack+'-LICENSE.txt'))
config={b:{**{phase:[f'materials/{b}/{phase}.wav'] for phase in ['early','mid','late','final']},'pitch':1,'pitchRandom':0,'volume':.76,'volumeRandom':.025} for b in PROFILES}
(ROOT/'wakppuball/js/material-sounds.js').write_text('// CC0 source-based material foley v2; no shared impact bed, no pitch shifting.\nwindow.WakppuMaterialSoundRevision="20261122-foley2";\nwindow.WakppuMaterialSounds='+json.dumps(config,separators=(',',':'))+';\n',encoding='utf8')
manifest={'version':2,'license':'CC0-1.0','author':'Kenney; original arrangement and fluid/air layers','pages':['https://kenney.nl/assets/impact-sounds','https://kenney.nl/assets/sci-fi-sounds'],'generator':'tools/build-material-sounds.py','sample_rate':SR,'channels':1,'pitch_shift':False,'shared_base_layer':False,'sources':used,'profiles':PROFILES,'outputs':outputs}
(OUT/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
(OUT/'README.md').write_text('# Material foley v2\n\nKenney Impact/Sci-fi source assets are CC0; original per-object arrangements, bubbles, air and tonal details are also CC0. Source URLs, source/output hashes and individual recipes are in sources.json; original license files are included. Build inputs are archived under tools/audio-sources/materials.\n\nThere is no common wax/noise/impact bed. Each object uses a different dominant source and temporal construction. Water gurgles; donut compresses and crumbles; chocolate snaps in separate fragments; diamond shatters; blackhole sucks inward; cloud puffs; embers pop individually. No source or playback pitch shifting is used. Durations vary by material and stage. Existing yellow, admin, seasonal, blue crystal and skin audio is untouched.\n\nRebuild with tools/build-material-sounds.py --ffmpeg PATH (NumPy required). Output: 22,050 Hz, mono PCM16; peaks 0.46/0.49/0.52/0.59, <=1.05 seconds. Selected-ball preload and bounded cache/voice limits remain. The sound engine appends the revision query to avoid replaying cached v1 audio.\n',encoding='utf8')
print('Built',len(outputs),'clips from',len(used),'different source assets;',sum((OUT/o['file']).stat().st_size for o in outputs),'WAV bytes')
