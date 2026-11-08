# Cari "inti suku kata" (puncak energi suara) per baris di vo_track.wav → timeline.json segmen[i]['inti'] (detik).
# Dipakai video.js supaya subtitle mengikuti ketukan ucapan, bukan sekadar jumlah huruf.
# Pakai: python3 alat/inti.py video/<nama>
import json, wave, sys, os, numpy as np
os.chdir(sys.argv[1])
T = json.load(open('timeline.json'))
w = wave.open('vo_track.wav'); sr = w.getframerate()
a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
hop, win = int(sr * 0.01), int(sr * 0.03)
f = np.fft.rfftfreq(win, 1 / sr); m = (f > 300) & (f < 2500); han = np.hanning(win)
for s in T['segmen']:
    i0, i1 = int(s['start'] * sr), int((s['start'] + s['dur']) * sr)
    x = a[i0:i1]
    E = np.array([np.abs(np.fft.rfft(x[i:i + win] * han))[m].sum() for i in range(0, max(1, len(x) - win), hop)])
    E = np.convolve(E, np.ones(5) / 5, 'same'); db = 20 * np.log10(E + 1e-9); mx = db.max()
    pk = []
    for i in range(1, len(db) - 1):
        if db[i] >= db[i - 1] and db[i] > db[i + 1] and db[i] > mx - 18:
            if pk and i - pk[-1] < 9:
                if db[i] > db[pk[-1]]: pk[-1] = i
                continue
            if pk and db[pk[-1]:i].min() > min(db[i], db[pk[-1]]) - 2.0: continue
            pk.append(i)
    s['inti'] = [round(s['start'] + p * 0.01, 3) for p in pk]
json.dump(T, open('timeline.json', 'w'), ensure_ascii=False)
print('inti:', [len(s['inti']) for s in T['segmen']])
