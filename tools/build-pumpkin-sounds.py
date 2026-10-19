"""Reproducible short Jack-o-lantern effects from Kenney CC0 packs; no network."""
import argparse,hashlib,json,subprocess,shutil
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--ffmpeg',required=True);a=p.parse_args()
out=Path(__file__).resolve().parent.parent/'wakppuball/sounds/pumpkin';out.mkdir(parents=True,exist_ok=True)
sr=22050
sources={'wood':('impact','impactWood_light_001.ogg'),'soft':('impact','impactSoft_medium_000.ogg'),'plank':('impact','impactPlank_medium_002.ogg'),'glass':('impact','impactGlass_heavy_001.ogg'),'field':('scifi','forceField_001.ogg'),'rumble':('scifi','lowFrequency_explosion_000.ogg')}
manifest={'license':'CC0-1.0','author':'Kenney','pages':['https://kenney.nl/assets/impact-sounds','https://kenney.nl/assets/sci-fi-sounds'],'sample_rate':sr,'sources':{},'outputs':[]}
for key,(pack,name) in sources.items():
 file=a.source/pack/'Audio'/name;manifest['sources'][key]={'file':pack+'/Audio/'+name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
def decode(key,rate):
 pack,name=sources[key];raw=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(a.source/pack/'Audio'/name),'-f','f32le','-ar',str(sr),'-ac','1','pipe:1'])
 x=np.frombuffer(raw,dtype='<f4');nz=np.flatnonzero(abs(x)>.003)
 if len(nz):x=x[max(0,nz[0]-44):]
 return np.interp(np.arange(0,len(x),rate),np.arange(len(x)),x)
recipes={
 'tap-1':(.18,[('wood',.78,.62,0),('soft',.8,.4,0),('field',.55,.07,.015)]),
 'tap-2':(.21,[('wood',.71,.57,0),('soft',.72,.4,0),('field',.58,.07,.018)]),
 'crack-mid':(.29,[('wood',.74,.6,0),('plank',.72,.38,.016),('field',.51,.1,.035)]),
 'crack-late':(.39,[('plank',.67,.64,0),('wood',.65,.35,.025),('field',.5,.13,.04)]),
 'break':(1.05,[('plank',.67,.66,0),('glass',.69,.2,.035),('rumble',.76,.28,.025),('field',.5,.15,.08)])}
for name,(duration,layers) in recipes.items():
 n=int(sr*duration);mix=np.zeros(n)
 for key,rate,gain,delay in layers:
  x=decode(key,rate);start=int(sr*delay);size=min(len(x),n-start);mix[start:start+size]+=x[:size]*gain
 # Small, decaying room reflections; no long ambience under rapid tapping.
 dry=mix.copy()
 for delay,gain in [(.043,.15),(.081,.07)]:
  shift=int(sr*delay);mix[shift:]+=dry[:-shift]*gain
 mix-=mix.mean();fade=min(n//3,int(sr*.065));mix[:70]*=np.linspace(0,1,70);mix[-fade:]*=np.linspace(1,0,fade)
 peak=max(float(np.max(abs(mix))),.001);mix*=min(1,.62/peak)
 target=out/(name+'.mp3');subprocess.run([a.ffmpeg,'-v','error','-y','-f','f32le','-ar',str(sr),'-ac','1','-i','pipe:0','-codec:a','libmp3lame','-b:a','64k',str(target)],input=mix.astype('<f4').tobytes(),check=True)
 manifest['outputs'].append({'file':target.name,'duration':duration,'peak':float(np.max(abs(mix))),'layers':layers,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
for pack in ['impact','scifi']:shutil.copyfile(a.source/pack/'License.txt',out/(pack+'-LICENSE.txt'))
(out/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print('Built 5 mono MP3 effects; peak <= .62')
