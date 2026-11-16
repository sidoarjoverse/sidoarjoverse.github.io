# Campur suara + efek suara jadi audio_final.wav.  Pakai: python3 alat/audio.py video/<nama>
import json, wave, sys, os, numpy as np
os.chdir(sys.argv[1]); SR = 44100
def baca(fn):
    w = wave.open(fn); return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
t = lambda d: np.arange(int(d * SR)) / SR
rng = np.random.default_rng(3)
def pop():
    x = t(0.12); f = 900 * np.exp(-x * 18) + 500; return 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 35)
def whoosh():
    x = t(0.5); n = np.convolve(rng.standard_normal(len(x)), np.ones(25) / 25, 'same'); return 0.6 * n * np.sin(np.pi * x / 0.5) ** 2
def krik():
    out = np.zeros(int(1.6 * SR))
    for s in (0.0, 0.75):
        for j in range(4):
            x = t(0.035); ch = 0.25 * np.sin(2 * np.pi * 4300 * x) * np.sin(np.pi * x / 0.035); i = int((s + j * 0.06) * SR); out[i:i + len(ch)] += ch
    return out
def tada():
    out = np.zeros(int(0.9 * SR))
    for i, f in enumerate([523, 659, 784, 1047]):
        x = t(0.5); s = 0.18 * (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(4 * np.pi * f * x)) * np.exp(-x * 5); a = int(i * 0.08 * SR); out[a:a + len(s)] += s
    return out
def stempel():
    x = t(0.25); return 0.7 * np.sin(2 * np.pi * 90 * x) * np.exp(-x * 22) + 0.25 * rng.standard_normal(len(x)) * np.exp(-x * 40)
def petir():
    x = t(1.8); n = rng.standard_normal(len(x)); lp = np.convolve(n, np.ones(60) / 60, 'same')
    return 1.6 * lp * (np.exp(-x * 2.2) + 0.6 * np.exp(-np.maximum(0, x - 0.35) * 3) * (x > 0.35))
def seram():
    x = t(2.4); f = 110 + 40 * np.sin(2 * np.pi * 0.7 * x); env = np.sin(np.pi * x / 2.4) ** 2
    return 0.35 * env * (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR))
def palu():   # ketukan palu & gergaji proyek, ramai
    out = np.zeros(int(2.4 * SR))
    for k in range(14):
        x = t(0.09); i = int((k * 0.17 + rng.random() * 0.05) * SR); f = 1400 + rng.random() * 900
        h = 0.45 * np.sin(2 * np.pi * f * x) * np.exp(-x * 60) + 0.25 * rng.standard_normal(len(x)) * np.exp(-x * 80)
        out[i:i + len(h)] += h
    return out
def lp(x, k): return np.convolve(x, np.ones(k) / k, 'same')
def suasana(jenis, d):   # suara latar panjang (found footage)
    n = int(d * SR); x = np.arange(n) / SR; out = 0.02 * lp(rng.standard_normal(n), 40)   # desis mikrofon
    if jenis in ('kota', 'siang'):
        out += 0.05 * lp(rng.standard_normal(n), 300) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.13 * x))   # dengung kota jauh
        for k in range(int(d * 1.3)):   # kicau burung
            i = int(rng.random() * n); L = int(0.09 * SR); y = np.arange(L) / SR; f = 2800 + 1600 * rng.random() + 900 * np.sin(2 * np.pi * 28 * y)
            ch = 0.06 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * y / 0.09); out[i:i + L] += ch[:max(0, min(L, n - i))]
    if jenis in ('malam', 'hutan'):
        ch = np.sin(2 * np.pi * 4600 * x) * (np.sin(2 * np.pi * 22 * x) > 0.6) * (np.sin(2 * np.pi * 0.9 * x) > -0.2)
        out += 0.035 * ch + 0.07 * lp(rng.standard_normal(n), 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * x))   # jangkrik + angin
    if jenis == 'hutan':
        out += 0.12 * np.sin(2 * np.pi * (55 + 6 * np.sin(2 * np.pi * 0.2 * x)) * x) * np.minimum(1, x / 3)   # dengung mencekam
        for tt in np.arange(2.0, d, 3.7):   # burung hantu
            i = int(tt * SR); L = int(0.5 * SR); y = np.arange(L) / SR; o = 0.12 * np.sin(2 * np.pi * 380 * y) * np.sin(np.pi * y / 0.5) ** 2; out[i:i + L] += o[:max(0, min(L, n - i))]
    if jenis == 'sungai':
        w = rng.standard_normal(n); out += 0.12 * (lp(w, 6) - lp(w, 60)) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.3 * x))   # gemericik air
        for tt in rng.random(int(d * 0.6)) * d:   # cipratan ikan
            i = int(tt * SR); L = int(0.25 * SR); y = np.arange(L) / SR; o = 0.25 * rng.standard_normal(L) * np.exp(-y * 18); out[i:i + L] += o[:max(0, min(L, n - i))]
    if jenis == 'rumah':
        for tt in np.arange(0.3, d, 1.0):   # jam dinding
            i = int(tt * SR); L = int(0.03 * SR); o = 0.08 * rng.standard_normal(L) * np.exp(-np.arange(L) / SR * 120); out[i:i + L] += o[:max(0, min(L, n - i))]
    fade = np.minimum(1, np.minimum(x / 0.3, (d - x) / 0.3)); return out * fade
def langkah(d):
    n = int(d * SR); out = np.zeros(n)
    for tt in np.arange(0.15, d, 0.52):
        i = int(tt * SR); L = int(0.12 * SR); y = np.arange(L) / SR
        o = 0.35 * lp(rng.standard_normal(L), 12) * np.exp(-y * 35) + 0.25 * np.sin(2 * np.pi * 70 * y) * np.exp(-y * 40); out[i:i + L] += o[:max(0, min(L, n - i))]
    return out
def glitch():
    x = t(0.35); return 0.35 * np.sign(np.sin(2 * np.pi * 60 * x)) * (rng.random(len(x)) > 0.5) * np.exp(-x * 4) + 0.2 * rng.standard_normal(len(x)) * np.exp(-x * 6)
def napas():
    x = t(3.2); env = np.maximum(0, np.sin(2 * np.pi * 0.7 * x)) ** 2; return 0.22 * lp(rng.standard_normal(len(x)), 30) * env
def krek():
    x = t(0.18); return 0.6 * rng.standard_normal(len(x)) * np.exp(-x * 45) + 0.3 * np.sin(2 * np.pi * 900 * x) * np.exp(-x * 60)
def beep():
    x = t(0.25); return 0.25 * np.sin(2 * np.pi * 2200 * x) * (x < 0.12) + 0.25 * np.sin(2 * np.pi * 2200 * x) * (x > 0.16)
SFX = {'glitch': glitch(), 'napas': napas(), 'krek': krek(), 'beep': beep(), 'palu': palu(), 'petir': petir(), 'seram': seram(), 'pop': pop(), 'whoosh': whoosh(), 'krik': krik(), 'tada': tada(), 'stempel': stempel()}
mix = baca('vo_track.wav').copy()
for tt, j in json.load(open('sfx.json')):
    if j.startswith('amb:'): _, jn, d = j.split(':'); s = suasana(jn, float(d)) / 0.55
    elif j.startswith('langkah:'): s = langkah(float(j.split(':')[1])) / 0.55
    else: s = SFX.get(j)
    i = int(tt * SR)
    if s is None or i >= len(mix): continue
    n = min(len(s), len(mix) - i); mix[i:i + n] += s[:n] * 0.55
mix = np.clip(mix / max(1.0, np.abs(mix).max() / 0.95), -1, 1)
w = wave.open('audio_final.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()
print('audio', round(len(mix) / SR, 2), 'detik')
