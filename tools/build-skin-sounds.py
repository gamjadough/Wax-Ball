"""Build short MP3 skin layers from Kenney CC0 source packs (no network)."""
import argparse,hashlib,json,subprocess
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--ffmpeg',required=True);a=p.parse_args()
root=Path(__file__).resolve().parent.parent;out=root/'wakppuball/sounds/eternity';out.mkdir(parents=True,exist_ok=True)
sources={
 'soft':('impact','impactSoft_medium_000'), 'wood':('impact','impactWood_light_001'),
 'plank':('impact','impactPlank_medium_002'), 'glass':('impact','impactGlass_light_002'),
 'shatter':('impact','impactGlass_heavy_001'), 'bell':('impact','impactBell_heavy_002'),
 'fire':('scifi','thrusterFire_000'), 'field':('scifi','forceField_001'),
 'space':('scifi','lowFrequency_explosion_000')}
sr=22050
def decode(key,rate=1):
 pack,name=sources[key];file=a.source/pack/'Audio'/(name+'.ogg')
 raw=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(file),'-f','f32le','-ac','1','-ar',str(sr),'pipe:1'])
 x=np.frombuffer(raw,dtype='<f4');nz=np.flatnonzero(abs(x)>.004)
 if len(nz):x=x[max(0,nz[0]-60):]
 if rate!=1:x=np.interp(np.arange(0,len(x),rate),np.arange(len(x)),x)
 return x
profiles={
 'common':[('soft',1,.8),('wood',.85,.3),('plank',.85,.55)],
 'rare':[('soft',1,.6),('glass',1.12,.35),('shatter',1,.55)],
 'hero':[('soft',.82,.7),('plank',.9,.55),('fire',1.2,.28)],
 'legendary':[('soft',.85,.7),('bell',1.3,.2),('field',1.25,.3)],
 'transcendent':[('soft',.72,.8),('plank',.7,.5),('space',1.1,.3),('field',.8,.22)]}
manifest={'license':'CC0-1.0','author':'Kenney','sources':{},'outputs':[]}
for key,(pack,name) in sources.items():
 file=a.source/pack/'Audio'/(name+'.ogg');manifest['sources'][key]={'pack':pack,'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
for rank,layers in profiles.items():
 for stage,duration in [('early',.18),('mid',.3),('late',.45),('final',1.15 if rank in ['legendary','transcendent'] else .85)]:
  n=int(sr*duration);mix=np.zeros(n)
  for i,(key,rate,gain) in enumerate(layers):
   x=decode(key,rate);delay=int(sr*(.025*i if stage=='final' else .006*i));length=min(len(x),n-delay)
   strength=gain*(1 if i==0 or stage=='final' else {'early':.2,'mid':.5,'late':.8}[stage])
   mix[delay:delay+length]+=x[:length]*strength
  # Smooth truncation and prevent clipping, with bounded short tails for rapid taps.
  fade=min(n//3,int(sr*.06));mix[-fade:]*=np.linspace(1,0,fade);mix[:70]*=np.linspace(0,1,70)
  peak=max(abs(mix).max(),.001);mix*=min(1,.72/peak)
  file=out/(rank+'-'+stage+'.mp3')
  subprocess.run([a.ffmpeg,'-v','error','-y','-f','f32le','-ar',str(sr),'-ac','1','-i','pipe:0','-codec:a','libmp3lame','-b:a','64k',str(file)],input=mix.astype('<f4').tobytes(),check=True)
  manifest['outputs'].append({'file':file.name,'duration':duration,'peak':float(abs(mix).max()),'layers':layers})
(out/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print(f'Built {len(manifest["outputs"])} MP3 clips; peak <= 0.72')
