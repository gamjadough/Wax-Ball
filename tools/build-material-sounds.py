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
 n=len(shell);duration=n/SR;t=np.arange(n)/SR;y=np.zeros(n)
 length=min(len(shell),n);y[:length]+=shell[:length]*.85
 start=round([3.30,6.22,10.62,14.58,22.17][i]*SR);core=honey[start:start+n].copy();core-=core.mean()
 freq=np.fft.rfftfreq(len(core),1/SR)
 core=np.fft.irfft(np.fft.rfft(core)/(1+(freq/3200)**8)*(1-1/(1+(freq/90)**6)),len(core))
 core/=max(float(np.max(np.abs(core))),1e-9)
 active=np.flatnonzero(np.abs(core)>.02)
 if len(active):core=core[int(active[0]):]
 offset=0;length=min(len(core),n)
 envelope=np.minimum(np.arange(length)/(.002*SR),1)*np.exp(-np.arange(length)/(SR*[.19,.23,.28,.32,.46][i]))
 y[offset:offset+length]+=core[:length]*envelope*[.24,.27,.30,.34,.40][i]
 y*=np.minimum(t/.0015,1)*np.minimum((duration-t)/.03,1).clip(0,1)
 target=[.46,.49,.52,.55,.59][i];y*=target/max(float(np.max(np.abs(y))),1e-9)
 resampled=subprocess.check_output([a.ffmpeg,'-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-ar','48000','-f','f32le','pipe:1'],input=y.astype('<f4').tobytes())
 peak=float(np.max(np.abs(np.frombuffer(resampled,dtype='<f4'))))
 if peak>target:y*=target/peak*.98
 pcm=np.round(y*32767).astype('<i2');file=OUT/'honey-wax'/(name+'.wav')
 with wave.open(str(file),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
 outputs.append(dict(file='honey-wax/'+name+'.wav',source='wax/'+name+'.wav + tools/audio-sources/honey-wax/honey.mp3',sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seconds=len(pcm)/SR,peak=float(np.max(np.abs(pcm.astype(float))))/32768,rms=float(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))))
# Nature grade: actual CC0 ice fractures combined with the shared wax shell.
ice_source=ROOT/'tools/audio-sources/recorded/ice.mp3'
raw=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(ice_source),'-f','f32le','-ac','1','-ar',str(SR),'pipe:1'])
ice=np.frombuffer(raw,dtype='<f4').astype(float)
sources[ice_source.relative_to(ROOT).as_posix()]=hashlib.sha256(ice_source.read_bytes()).hexdigest()
(OUT/'ice-wax').mkdir(exist_ok=True)
for i,name in enumerate(['early','tap','mid','late','final']):
 with wave.open(str(OUT/'wax'/(name+'.wav')),'rb') as f:shell=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32768
 duration=[.24,.30,.40,.50,.76][i];n=round(duration*SR);t=np.arange(n)/SR;y=np.zeros(n)
 length=min(len(shell),n);y[:length]+=shell[:length]*.50
 start=round([.135,10.64,14.13,25.82,38.02][i]*SR);fracture=ice[start:start+n].copy();fracture-=fracture.mean()
 freq=np.fft.rfftfreq(len(fracture),1/SR)
 fracture=np.fft.irfft(np.fft.rfft(fracture)/(1+(freq/7600)**8)*(1-1/(1+(freq/70)**6)),len(fracture))
 fracture/=max(float(np.max(np.abs(fracture))),1e-9)
 offset=round(.006*SR);length=min(len(fracture),n-offset)
 y[offset:offset+length]+=fracture[:length]*[.35,.38,.42,.48,.55][i]
 y*=np.minimum(t/.0015,1)*np.minimum((duration-t)/.025,1).clip(0,1)
 target=[.46,.49,.52,.55,.59][i];y*=target/max(float(np.max(np.abs(y))),1e-9)
 resampled=subprocess.check_output([a.ffmpeg,'-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-ar','48000','-f','f32le','pipe:1'],input=y.astype('<f4').tobytes())
 peak=float(np.max(np.abs(np.frombuffer(resampled,dtype='<f4'))))
 if peak>target:y*=target/peak*.98
 pcm=np.round(y*32767).astype('<i2');file=OUT/'ice-wax'/(name+'.wav')
 with wave.open(str(file),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
 outputs.append(dict(file='ice-wax/'+name+'.wav',source='wax/'+name+'.wav + tools/audio-sources/recorded/ice.mp3',sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seconds=len(pcm)/SR,peak=float(np.max(np.abs(pcm.astype(float))))/32768,rms=float(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))))
# Gem grade uses actual individual mechanical-key presses, with no wax overlay.
keycap_meta=json.loads((ROOT/'tools/audio-sources/keycap/source.json').read_text())
(OUT/'keycap').mkdir(exist_ok=True)
for i,entry in enumerate(keycap_meta['samples']):
 name=entry['stage'];source=ROOT/'tools/audio-sources/keycap'/entry['file']
 raw=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(source),'-f','f32le','-ac','1','-ar',str(SR),'pipe:1'])
 x=np.frombuffer(raw,dtype='<f4').astype(float);x-=x.mean()
 active=np.flatnonzero(np.abs(x)>float(np.max(np.abs(x)))*.015)
 if len(active):x=x[max(0,int(active[0])-round(.003*SR)):min(len(x),int(active[-1])+round(.02*SR))]
 if len(x)<round(.12*SR):x=np.pad(x,(0,round(.12*SR)-len(x)))
 t=np.arange(len(x))/SR;duration=len(x)/SR
 x*=np.minimum(t/.001,1)*np.minimum((duration-t)/.012,1).clip(0,1)
 target=[.46,.49,.52,.55,.59][i];x*=target/max(float(np.max(np.abs(x))),1e-9)
 resampled=subprocess.check_output([a.ffmpeg,'-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-ar','48000','-f','f32le','pipe:1'],input=x.astype('<f4').tobytes())
 peak=float(np.max(np.abs(np.frombuffer(resampled,dtype='<f4'))))
 if peak>target:x*=target/peak*.98
 pcm=np.round(x*32767).astype('<i2');file=OUT/'keycap'/(name+'.wav')
 with wave.open(str(file),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
 sourcefile=source.relative_to(ROOT).as_posix();sources[sourcefile]=hashlib.sha256(source.read_bytes()).hexdigest()
 outputs.append(dict(file='keycap/'+name+'.wav',source=sourcefile,sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seconds=len(pcm)/SR,peak=float(np.max(np.abs(pcm.astype(float))))/32768,rms=float(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))))
# Space grade: keycap and honey begin together and share the same short window.
(OUT/'honey-keycap').mkdir(exist_ok=True)
for i,name in enumerate(['early','tap','mid','late','final']):
 with wave.open(str(OUT/'keycap'/(name+'.wav')),'rb') as f:key=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32768
 n=len(key);duration=n/SR;t=np.arange(n)/SR;y=np.zeros(n)
 length=min(len(key),n);y[:length]+=key[:length]*.95
 start=round([3.30,6.22,10.62,14.58,22.17][i]*SR);core=honey[start:start+n].copy();core-=core.mean()
 freq=np.fft.rfftfreq(len(core),1/SR)
 core=np.fft.irfft(np.fft.rfft(core)/(1+(freq/2800)**8)*(1-1/(1+(freq/100)**6)),len(core))
 core/=max(float(np.max(np.abs(core))),1e-9)
 active=np.flatnonzero(np.abs(core)>.02)
 if len(active):core=core[int(active[0]):]
 offset=0;length=min(len(core),n)
 envelope=np.minimum(np.arange(length)/(.002*SR),1)*np.exp(-np.arange(length)/(SR*[.13,.16,.20,.23,.32][i]))
 y[offset:offset+length]+=core[:length]*envelope*[.16,.18,.21,.24,.28][i]
 y*=np.minimum(t/.001,1)*np.minimum((duration-t)/.02,1).clip(0,1)
 target=[.46,.49,.52,.55,.59][i];y*=target/max(float(np.max(np.abs(y))),1e-9)
 resampled=subprocess.check_output([a.ffmpeg,'-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-ar','48000','-f','f32le','pipe:1'],input=y.astype('<f4').tobytes())
 peak=float(np.max(np.abs(np.frombuffer(resampled,dtype='<f4'))))
 if peak>target:y*=target/peak*.98
 pcm=np.round(y*32767).astype('<i2');file=OUT/'honey-keycap'/(name+'.wav')
 with wave.open(str(file),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
 outputs.append(dict(file='honey-keycap/'+name+'.wav',source='keycap/'+name+'.wav + tools/audio-sources/honey-wax/honey.mp3',sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seconds=len(pcm)/SR,peak=float(np.max(np.abs(pcm.astype(float))))/32768,rms=float(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))))
# Dimension grade: honey, wax and butter-style soft core start together.
raw=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(fruit_source),'-f','f32le','-ac','1','-ar',str(SR),'pipe:1'])
butter=np.frombuffer(raw,dtype='<f4').astype(float);butter-=butter.mean()
freq=np.fft.rfftfreq(len(butter),1/SR)
butter=np.fft.irfft(np.fft.rfft(butter)/(1+(freq/2800)**8),len(butter))
butter/=max(float(np.max(np.abs(butter))),1e-9)
active=np.flatnonzero(np.abs(butter)>.02)
if len(active):butter=butter[int(active[0]):]
(OUT/'honey-wax-butter').mkdir(exist_ok=True)
for i,name in enumerate(['early','tap','mid','late','final']):
 with wave.open(str(OUT/'wax'/(name+'.wav')),'rb') as f:shell=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32768
 n=len(shell);duration=n/SR;t=np.arange(n)/SR;y=shell*.85
 start=round([3.30,6.22,10.62,14.58,22.17][i]*SR);sticky=honey[start:start+n].copy();sticky-=sticky.mean()
 freq=np.fft.rfftfreq(len(sticky),1/SR)
 sticky=np.fft.irfft(np.fft.rfft(sticky)/(1+(freq/2800)**8)*(1-1/(1+(freq/100)**6)),len(sticky))
 sticky/=max(float(np.max(np.abs(sticky))),1e-9)
 active=np.flatnonzero(np.abs(sticky)>.02)
 if len(active):sticky=sticky[int(active[0]):]
 for layer,gain in [(sticky,[.18,.20,.23,.26,.30][i]),(butter,[.15,.17,.19,.21,.25][i])]:
  length=min(len(layer),n);envelope=np.minimum(np.arange(length)/(.002*SR),1)*np.exp(-np.arange(length)/(SR*[.16,.18,.23,.19,.28][i]))
  y[:length]+=layer[:length]*envelope*gain
 y*=np.minimum(t/.0015,1)*np.minimum((duration-t)/.025,1).clip(0,1)
 target=[.46,.49,.52,.55,.59][i];y*=target/max(float(np.max(np.abs(y))),1e-9)
 resampled=subprocess.check_output([a.ffmpeg,'-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-ar','48000','-f','f32le','pipe:1'],input=y.astype('<f4').tobytes())
 peak=float(np.max(np.abs(np.frombuffer(resampled,dtype='<f4'))))
 if peak>target:y*=target/peak*.98
 pcm=np.round(y*32767).astype('<i2');file=OUT/'honey-wax-butter'/(name+'.wav')
 with wave.open(str(file),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
 outputs.append(dict(file='honey-wax-butter/'+name+'.wav',source='wax/'+name+'.wav + tools/audio-sources/honey-wax/honey.mp3 + tools/audio-sources/fruit-wax/slime.mp3',sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seconds=len(pcm)/SR,peak=float(np.max(np.abs(pcm.astype(float))))/32768,rms=float(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))))
# Transcendent grade: offline blend of all five approved ASMR texture families.
(OUT/'transcendent-asmr').mkdir(exist_ok=True)
for i,name in enumerate(['early','tap','mid','late','final']):
 def read_pcm(folder):
  with wave.open(str(OUT/folder/(name+'.wav')),'rb') as f:return np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32768
 shell=read_pcm('wax');key=read_pcm('keycap');n=len(shell);duration=n/SR;t=np.arange(n)/SR;y=shell*.70
 start=round([3.30,6.22,10.62,14.58,22.17][i]*SR);sticky=honey[start:start+n].copy();sticky-=sticky.mean()
 freq=np.fft.rfftfreq(len(sticky),1/SR)
 sticky=np.fft.irfft(np.fft.rfft(sticky)/(1+(freq/2800)**8)*(1-1/(1+(freq/100)**6)),len(sticky))
 sticky/=max(float(np.max(np.abs(sticky))),1e-9)
 active=np.flatnonzero(np.abs(sticky)>.02)
 if len(active):sticky=sticky[int(active[0]):]
 start=round([.135,10.64,14.13,25.82,38.02][i]*SR);shards=ice[start:start+n].copy();shards-=shards.mean()
 freq=np.fft.rfftfreq(len(shards),1/SR)
 shards=np.fft.irfft(np.fft.rfft(shards)/(1+(freq/6500)**8)*(1-1/(1+(freq/600)**6)),len(shards))
 shards/=max(float(np.max(np.abs(shards))),1e-9)
 active=np.flatnonzero(np.abs(shards)>.02)
 if len(active):shards=shards[int(active[0]):]
 for layer,gain in [(key,.25),(butter,[.12,.13,.14,.16,.19][i]),(sticky,[.14,.15,.17,.19,.22][i]),(shards,[.12,.13,.15,.17,.21][i])]:
  length=min(len(layer),n);envelope=np.minimum(np.arange(length)/(.002*SR),1)*np.exp(-np.arange(length)/(SR*[.16,.18,.23,.19,.28][i]))
  y[:length]+=layer[:length]*envelope*gain
 y*=np.minimum(t/.0015,1)*np.minimum((duration-t)/.025,1).clip(0,1)
 target=[.46,.49,.52,.55,.59][i];y*=target/max(float(np.max(np.abs(y))),1e-9)
 rms=float(np.sqrt(np.mean(y*y)))
 if rms>.12:y*=.12/rms
 resampled=subprocess.check_output([a.ffmpeg,'-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-ar','48000','-f','f32le','pipe:1'],input=y.astype('<f4').tobytes())
 peak=float(np.max(np.abs(np.frombuffer(resampled,dtype='<f4'))))
 if peak>target:y*=target/peak*.98
 pcm=np.round(y*32767).astype('<i2');file=OUT/'transcendent-asmr'/(name+'.wav')
 with wave.open(str(file),'wb') as f:f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
 outputs.append(dict(file='transcendent-asmr/'+name+'.wav',source='wax + keycap + CC0 butter-style core + honey + ice (see source hashes)',sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seconds=len(pcm)/SR,peak=float(np.max(np.abs(pcm.astype(float))))/32768,rms=float(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))))
config={b:dict(early=['materials/wax/early.wav','materials/wax/tap.wav'],mid=['materials/wax/mid.wav'],late=['materials/wax/late.wav'],final=['materials/wax/final.wav'],pitch=1,pitchRandom=0,volume=.76,volumeRandom=0) for b in ids}
for b in ['strawberry','apple']:
 for stage in ['early','mid','late','final']:config[b][stage]=[name.replace('materials/wax/','materials/fruit-wax/') for name in config[b][stage]]
for b in ['chocolate','donut']:
 for stage in ['early','mid','late','final']:config[b][stage]=[name.replace('materials/wax/','materials/honey-wax/') for name in config[b][stage]]
for b in ['rainbow','water']:
 for stage in ['early','mid','late','final']:config[b][stage]=[name.replace('materials/wax/','materials/ice-wax/') for name in config[b][stage]]
for b in ['emerald','diamond']:
 for stage in ['early','mid','late','final']:config[b][stage]=[name.replace('materials/wax/','materials/keycap/') for name in config[b][stage]]
for b in ['planet','sun']:
 for stage in ['early','mid','late','final']:config[b][stage]=[name.replace('materials/wax/','materials/honey-keycap/') for name in config[b][stage]]
for b in ['blackhole','whitehole']:
 for stage in ['early','mid','late','final']:config[b][stage]=[name.replace('materials/wax/','materials/honey-wax-butter/') for name in config[b][stage]]
for b in ['starlight','hellfire','heaven-cloud','hell-ember','heaven-gem','hell-core','judgment','heaven-earth','soul','eternity']:
 for stage in ['early','mid','late','final']:config[b][stage]=[name.replace('materials/wax/','materials/transcendent-asmr/') for name in config[b][stage]]
(ROOT/'wakppuball/js/material-sounds.js').write_text('// Shared wax cracking, adapted from the existing yellow source; see sounds/materials/CREDITS.txt.\nwindow.WakppuMaterialSoundRevision="20261123-transcendent13";\nwindow.WakppuMaterialSounds='+json.dumps(config,separators=(',',':'))+';\n',encoding='utf8')
manifest=dict(version=13,license='Pixabay Content License + CC0-1.0',page='https://pixabay.com/sound-effects/film-special-effects-bones-cracking-482875/',license_url='https://pixabay.com/service/license-summary/',author='DRAGON-STUDIO, qubodup, hello_world+123, Nox_Sound, StavSounds',generator='tools/build-material-sounds.py',sample_rate=SR,channels=1,pitch_shift=False,shared_base_layer=True,profiles=ids,sources=sources,recordings=[json.loads((ROOT/f'tools/audio-sources/{family}/source.json').read_text()) for family in ['fruit-wax','honey-wax','ice-wax','keycap']],outputs=outputs)
(OUT/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
# Remove only obsolete generated WAVs recorded by the previous manifest.
keep={o['file'] for o in outputs}
for old in previous['outputs']:
 path=(OUT/old['file']).resolve()
 if old['file'] not in keep and path.is_relative_to(OUT.resolve()) and path.suffix=='.wav' and path.is_file():path.unlink()
(OUT/'README.md').write_text('# Shared wax cracking\n\nGreen uses five short clips adapted from the existing yellow ball recording. Strawberry/apple use five fruit-wax clips: a thin wax-like crack plus a quiet low-passed CC0 soft-core squish. Chocolate/donut use five honey-wax clips: wax fractures plus real honey squeezed from a bottle (CC0), mixed simultaneously in the wax clip window. Rainbow/water use five ice-wax clips combining real ice fractures (Nox_Sound, CC0) with a quieter wax shell. Emerald/diamond use five real tactile/clicky mechanical-key presses (StavSounds, CC0), with no wax overlay. Planet/sun use five honey-keycap clips combining the mechanical-key press with honey starting at the same instant and ending inside the keypress window. Blackhole/whitehole use five simultaneous honey + wax + butter-style soft-core mixes, exactly bounded to the wax clip duration. All ten transcendent base balls use one offline mix of wax, butter-style core, honey, ice and mechanical keys, all starting together, with an RMS ceiling and no extra tail. The wax-style families are Foley approximations, not recordings of actual wax-butter or honey-wax squishies. Early hits alternate two cracks; mid/late/final progress through the remaining three. No sequence overrides final: the final hit always uses final.wav. No pitch shift, synthetic theme layer or time stretching. Mono PCM16 at 22050 Hz, normalized levels with 48 kHz resampling peak protection. Original yellow and explicitly configured admin/gem/seasonal/skin/custom audio remain unchanged. Forty shared files replace 92 generated WAVs. Bounded voices/cache and mute remain active. See CREDITS.txt for author, source, license and edits.\n',encoding='utf8')
print('Built',len(outputs),'shared clips for',len(ids),'balls;',sum((OUT/o['file']).stat().st_size for o in outputs),'bytes')
