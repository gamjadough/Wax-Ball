"""Shared yellow-style wax cracks. No theme synthesis, pitch shifts or time stretching.
Build with --ffmpeg PATH. Existing yellow source clips stay byte-identical.
"""
from pathlib import Path
import argparse,hashlib,json,shutil,subprocess,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'wakppuball/sounds/materials';SR=22050
p=argparse.ArgumentParser();p.add_argument('--ffmpeg',default=shutil.which('ffmpeg'));a=p.parse_args()
if not a.ffmpeg:p.error('--ffmpeg required')
ids='green strawberry apple chocolate donut rainbow water emerald diamond planet sun blackhole whitehole starlight hellfire heaven-cloud hell-ember heaven-gem hell-core judgment heaven-earth soul eternity'.split()
previous=json.loads((OUT/'sources.json').read_text(encoding='utf8'))
(OUT/'wax').mkdir(exist_ok=True)
outputs=[];sources={}
for i,name in enumerate(['early','tap','mid','late','final'],1):
 source=ROOT/f'wakppuball/sounds/yellow-crack-{i}.wav'
 raw=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(source),'-f','f32le','-ac','1','-ar',str(SR),'pipe:1'])
 x=np.frombuffer(raw,dtype='<f4').astype(float)
 # Level only; keep the original short attack, fracture texture and duration.
 target=[.46,.49,.52,.55,.59][i-1];x*=target/max(float(np.max(np.abs(x))),1e-9)
 resampled=subprocess.check_output([a.ffmpeg,'-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-ar','48000','-f','f32le','pipe:1'],input=x.astype('<f4').tobytes())
 peak=float(np.max(np.abs(np.frombuffer(resampled,dtype='<f4'))))
 if peak>target:x*=target/peak*.98
 pcm=np.round(x*32767).astype('<i2');file=OUT/'wax'/(name+'.wav')
 with wave.open(str(file),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
 sourcefile=source.relative_to(ROOT).as_posix();sources[sourcefile]=hashlib.sha256(source.read_bytes()).hexdigest()
 outputs.append(dict(file='wax/'+name+'.wav',source=sourcefile,sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seconds=len(pcm)/SR,peak=float(np.max(np.abs(pcm.astype(float))))/32768,rms=float(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))))
# Fruit-only wax-butter-style foley: crisp thin shell plus a quiet soft core.
# This is a licensed Foley mix, not a recording of an actual wax-butter squishy.
fruit_source=ROOT/'tools/audio-sources/fruit-wax/slime.mp3'
raw=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(fruit_source),'-f','f32le','-ac','1','-ar',str(SR),'pipe:1'])
core=np.frombuffer(raw,dtype='<f4').astype(float);core-=core.mean()
freq=np.fft.rfftfreq(len(core),1/SR)
core=np.fft.irfft(np.fft.rfft(core)/(1+(freq/2800)**8),len(core))
core/=max(float(np.max(np.abs(core))),1e-9)
sources[fruit_source.relative_to(ROOT).as_posix()]=hashlib.sha256(fruit_source.read_bytes()).hexdigest()
(OUT/'fruit-wax').mkdir(exist_ok=True)
for i,name in enumerate(['early','tap','mid','late','final']):
 with wave.open(str(OUT/'wax'/(name+'.wav')),'rb') as f:shell=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32768
 duration=[.26,.30,.38,.42,.62][i];n=round(duration*SR);t=np.arange(n)/SR;y=np.zeros(n)
 length=min(len(shell),n);y[:length]+=shell[:length]*[.85,.85,.90,.95,1][i]
 offset=round(.018*SR);length=min(len(core),n-offset)
 envelope=np.minimum(np.arange(length)/(.008*SR),1)*np.exp(-np.arange(length)/(SR*[.12,.14,.17,.19,.26][i]))
 y[offset:offset+length]+=core[:length]*envelope*[.10,.12,.15,.18,.22][i]
 y*=np.minimum(t/.0015,1)*np.minimum((duration-t)/.025,1).clip(0,1)
 target=[.46,.49,.52,.55,.59][i];y*=target/max(float(np.max(np.abs(y))),1e-9)
 resampled=subprocess.check_output([a.ffmpeg,'-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-ar','48000','-f','f32le','pipe:1'],input=y.astype('<f4').tobytes())
 peak=float(np.max(np.abs(np.frombuffer(resampled,dtype='<f4'))))
 if peak>target:y*=target/peak*.98
 pcm=np.round(y*32767).astype('<i2');file=OUT/'fruit-wax'/(name+'.wav')
 with wave.open(str(file),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
 outputs.append(dict(file='fruit-wax/'+name+'.wav',source='wax/'+name+'.wav + tools/audio-sources/fruit-wax/slime.mp3',sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seconds=len(pcm)/SR,peak=float(np.max(np.abs(pcm.astype(float))))/32768,rms=float(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))))
# Snack-grade honey-wax Foley: wax fractures plus distinct real honey squeeze excerpts.
honey_source=ROOT/'tools/audio-sources/honey-wax/honey.mp3'
raw=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(honey_source),'-f','f32le','-ac','1','-ar',str(SR),'pipe:1'])
honey=np.frombuffer(raw,dtype='<f4').astype(float)
sources[honey_source.relative_to(ROOT).as_posix()]=hashlib.sha256(honey_source.read_bytes()).hexdigest()
(OUT/'honey-wax').mkdir(exist_ok=True)
for i,name in enumerate(['early','tap','mid','late','final']):
 with wave.open(str(OUT/'wax'/(name+'.wav')),'rb') as f:shell=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32768
 duration=[.32,.38,.46,.54,.78][i];n=round(duration*SR);t=np.arange(n)/SR;y=np.zeros(n)
 length=min(len(shell),n);y[:length]+=shell[:length]*.85
 start=round([3.30,6.22,10.62,14.58,22.17][i]*SR);core=honey[start:start+n].copy();core-=core.mean()
 freq=np.fft.rfftfreq(len(core),1/SR)
 core=np.fft.irfft(np.fft.rfft(core)/(1+(freq/3200)**8)*(1-1/(1+(freq/90)**6)),len(core))
 core/=max(float(np.max(np.abs(core))),1e-9)
 offset=round(.025*SR);length=min(len(core),n-offset)
 envelope=np.minimum(np.arange(length)/(.012*SR),1)*np.exp(-np.arange(length)/(SR*[.19,.23,.28,.32,.46][i]))
 y[offset:offset+length]+=core[:length]*envelope*[.24,.27,.30,.34,.40][i]
 y*=np.minimum(t/.0015,1)*np.minimum((duration-t)/.03,1).clip(0,1)
 target=[.46,.49,.52,.55,.59][i];y*=target/max(float(np.max(np.abs(y))),1e-9)
 resampled=subprocess.check_output([a.ffmpeg,'-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-ar','48000','-f','f32le','pipe:1'],input=y.astype('<f4').tobytes())
 peak=float(np.max(np.abs(np.frombuffer(resampled,dtype='<f4'))))
 if peak>target:y*=target/peak*.98
 pcm=np.round(y*32767).astype('<i2');file=OUT/'honey-wax'/(name+'.wav')
 with wave.open(str(file),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
 outputs.append(dict(file='honey-wax/'+name+'.wav',source='wax/'+name+'.wav + tools/audio-sources/honey-wax/honey.mp3',sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seconds=len(pcm)/SR,peak=float(np.max(np.abs(pcm.astype(float))))/32768,rms=float(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))))
config={b:dict(early=['materials/wax/early.wav','materials/wax/tap.wav'],mid=['materials/wax/mid.wav'],late=['materials/wax/late.wav'],final=['materials/wax/final.wav'],pitch=1,pitchRandom=0,volume=.76,volumeRandom=0) for b in ids}
for b in ['strawberry','apple']:
 for stage in ['early','mid','late','final']:config[b][stage]=[name.replace('materials/wax/','materials/fruit-wax/') for name in config[b][stage]]
for b in ['chocolate','donut']:
 for stage in ['early','mid','late','final']:config[b][stage]=[name.replace('materials/wax/','materials/honey-wax/') for name in config[b][stage]]
(ROOT/'wakppuball/js/material-sounds.js').write_text('// Shared wax cracking, adapted from the existing yellow source; see sounds/materials/CREDITS.txt.\nwindow.WakppuMaterialSoundRevision="20261123-honey7";\nwindow.WakppuMaterialSounds='+json.dumps(config,separators=(',',':'))+';\n',encoding='utf8')
manifest=dict(version=7,license='Pixabay Content License + CC0-1.0',page='https://pixabay.com/sound-effects/film-special-effects-bones-cracking-482875/',license_url='https://pixabay.com/service/license-summary/',author='DRAGON-STUDIO, qubodup, hello_world+123',generator='tools/build-material-sounds.py',sample_rate=SR,channels=1,pitch_shift=False,shared_base_layer=True,profiles=ids,sources=sources,recordings=[json.loads((ROOT/f'tools/audio-sources/{family}/source.json').read_text()) for family in ['fruit-wax','honey-wax']],outputs=outputs)
(OUT/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
# Remove only obsolete generated WAVs recorded by the previous manifest.
keep={o['file'] for o in outputs}
for old in previous['outputs']:
 path=(OUT/old['file']).resolve()
 if old['file'] not in keep and path.is_relative_to(OUT.resolve()) and path.suffix=='.wav' and path.is_file():path.unlink()
(OUT/'README.md').write_text('# Shared wax cracking\n\nThe 19 non-fruit/non-snack ordinary balls share five short clips adapted from the existing yellow ball recording. Strawberry/apple use five fruit-wax clips: a thin wax-like crack plus a quiet low-passed CC0 soft-core squish. Chocolate/donut use five honey-wax clips: wax fractures plus real honey squeezed from a bottle (CC0), with a longer sticky tail. These are Foley approximations, not recordings of actual wax-butter or honey-wax squishies. Early hits alternate two cracks; mid/late/final progress through the remaining three. No sequence overrides final: the final hit always uses final.wav. No pitch shift, synthetic theme layer or time stretching. Mono PCM16 at 22050 Hz, normalized levels with 48 kHz resampling peak protection. Original yellow and explicitly configured admin/gem/seasonal/skin/custom audio remain unchanged. Fifteen shared files replace 92 generated WAVs. Bounded voices/cache and mute remain active. See CREDITS.txt for author, source, license and edits.\n',encoding='utf8')
print('Built',len(outputs),'shared clips for',len(ids),'balls;',sum((OUT/o['file']).stat().st_size for o in outputs),'bytes')
