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
config={b:dict(early=['materials/wax/early.wav','materials/wax/tap.wav'],mid=['materials/wax/mid.wav'],late=['materials/wax/late.wav'],final=['materials/wax/final.wav'],pitch=1,pitchRandom=0,volume=.76,volumeRandom=0) for b in ids}
(ROOT/'wakppuball/js/material-sounds.js').write_text('// Shared wax cracking, adapted from the existing yellow source; see sounds/materials/CREDITS.txt.\nwindow.WakppuMaterialSoundRevision="20261123-wax5";\nwindow.WakppuMaterialSounds='+json.dumps(config,separators=(',',':'))+';\n',encoding='utf8')
manifest=dict(version=5,license='Pixabay Content License',page='https://pixabay.com/sound-effects/film-special-effects-bones-cracking-482875/',license_url='https://pixabay.com/service/license-summary/',author='DRAGON-STUDIO',generator='tools/build-material-sounds.py',sample_rate=SR,channels=1,pitch_shift=False,shared_base_layer=True,profiles=ids,sources=sources,outputs=outputs)
(OUT/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
# Remove only obsolete generated WAVs recorded by the previous manifest.
keep={o['file'] for o in outputs}
for old in previous['outputs']:
 path=(OUT/old['file']).resolve()
 if old['file'] not in keep and path.is_relative_to(OUT.resolve()) and path.suffix=='.wav' and path.is_file():path.unlink()
(OUT/'README.md').write_text('# Shared wax cracking\n\nAll 23 ordinary non-yellow balls share five short clips adapted from the existing yellow ball recording. Early hits alternate two cracks; mid/late/final progress through the remaining three. No sequence overrides final: the final hit always uses final.wav. No pitch shift, synthetic theme layer or time stretching. Mono PCM16 at 22050 Hz, normalized levels with 48 kHz resampling peak protection. Original yellow and explicitly configured admin/gem/seasonal/skin/custom audio remain unchanged. Five shared files replace 92 generated WAVs. Bounded voices/cache and mute remain active. See CREDITS.txt for author, source, license and edits.\n',encoding='utf8')
print('Built',len(outputs),'shared clips for',len(ids),'balls;',sum((OUT/o['file']).stat().st_size for o in outputs),'bytes')
