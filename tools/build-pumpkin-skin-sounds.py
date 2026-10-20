"""Original sample-free pumpkin Foley, rendered deterministically with Python stdlib.

No eternity recordings, bell samples, music or third-party source audio is used.
Hollow rind/body modes + filtered air + short shell transients, not sustained chimes.
"""
from pathlib import Path
import math, random, struct, wave
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'wakppuball/sounds/pumpkin-skins'
SR=24000
DURATIONS={'wisp':[.22,.30,.42,.92],'ghost':[.28,.38,.52,1.18],'eclipse':[.26,.39,.55,1.30]}

def render(kind,stage,duration):
    rng=random.Random(70100+list(DURATIONS).index(kind)*101+stage)
    low=0.0; slow=0.0; data=[]
    bursts=[(.0,.7),(.028,.24),(.067,.16)]
    if stage>0:bursts += [(.10,.18),(.16,.12)]
    if stage==3:
        # Eclipse's main rind rupture aligns with the 430ms visual release.
        delay=.43 if kind=='eclipse' else .12
        bursts += [(delay,.85),(delay+.025,.38),(delay+.073,.27),(delay+.16,.12)]
    root={'wisp':172,'ghost':112,'eclipse':83}[kind]
    for i in range(round(SR*duration)):
        t=i/SR; n=rng.uniform(-1,1)
        low += .17*(n-low); slow += .018*(n-slow)
        band=low-slow
        thud=sum(math.sin(2*math.pi*root*r*t)*math.exp(-t*d)*a for r,d,a in [(1,24,.42),(1.61,33,.24),(2.53,48,.12),(3.91,62,.06)])
        shell=sum(band*amp*math.exp(-(t-at)*85) for at,amp in bursts if t>=at)
        # Wax rub: shaped air rather than a periodic pitched bell.
        air=band*.10*math.sin(math.pi*min(1,t/duration))**2
        if kind=='wisp':air*=1.8;thud*=.72
        if kind=='ghost':air*=1.4+.45*math.sin(t*18);thud+=.09*math.sin(2*math.pi*71*t)*math.exp(-t*13)
        if kind=='eclipse':
            thud+=.16*math.sin(2*math.pi*(58*t-9*t*t))*math.exp(-t*15)
            if stage==3:
                # Short intake -> silence notch -> physical release, with phone-audible harmonics.
                intake=max(0,min(1,t/.34))*max(0,min(1,(.43-t)/.07))
                air+=band*.36*intake
                q=t-.43
                if q>=0:
                    thud+=sum(a*math.sin(2*math.pi*(f*q-8*q*q))*math.exp(-q*d) for f,a,d in [(48,.38,6),(96,.19,9),(153,.10,12)])
                    air+=band*.24*math.exp(-q*7)
        attack=min(1,t/.003);tail=min(1,(duration-t)/.035)
        data.append(math.tanh((thud+shell+air)*1.2)*attack*tail)
    mean=sum(data)/len(data);data=[x-mean for x in data]
    peak=max(map(abs,data));gain=.56/peak
    # Reapply tiny endpoint fade after DC removal; leave no abrupt clicks at file boundaries.
    return [round(max(-1,min(1,x*gain))*min(1,i/72,(len(data)-1-i)/360)*32767) for i,x in enumerate(data)]

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    for kind,durations in DURATIONS.items():
        for stage,duration in enumerate(durations):
            samples=render(kind,stage,duration)
            path=OUT/f'{kind}-{["early","mid","late","final"][stage]}.wav'
            with wave.open(str(path),'wb') as w:
                w.setparams((1,2,SR,0,'NONE','not compressed'))
                w.writeframes(struct.pack('<'+'h'*len(samples),*samples))
            print(path.name, f'{duration:.2f}s',len(samples)*2,'bytes')
