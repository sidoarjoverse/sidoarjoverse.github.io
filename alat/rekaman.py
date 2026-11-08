# Timeline dari SATU rekaman utuh (vo_semua.wav) tanpa dipotong: baris.json = [{"a": detik, "b": detik, "cap": "teks subtitle"}]
# Waktu subtitle per potongan diambil dari waktu kata hasil pengenal suara (vo_semua.stt.json, faster-whisper).
# Pakai: python3 alat/rekaman.py video/<nama>
import json, wave, sys, os, re, numpy as np
os.chdir(sys.argv[1]); FPS, SR, AWAL, AKHIR = 30, 44100, 0.35, 1.4
B = json.load(open('baris.json'))
w = wave.open('vo_semua.wav'); sr = w.getframerate(); assert sr == SR
a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
track = np.concatenate([np.zeros(int(AWAL * SR), np.float32), a, np.zeros(int(AKHIR * SR), np.float32)])
total = len(track) / SR
kata = [(x[0] + AWAL, x[2].strip()) for s in json.load(open('vo_semua.stt.json')) for x in s['w']]
suku = lambda s: max(1, len(re.findall(r'[aiueo]+', re.sub(r'[^a-z]', '', s.lower().replace('ktp', 'katepe')))))
def potong_teks(cap):          # aturan sama dengan video.js: ≤22 huruf, putus di tanda baca
    ch, cur = [], []
    for k in cap.split(' '):
        if cur and len(' '.join(cur + [k])) > 22: ch.append(' '.join(cur)); cur = []
        cur.append(k)
        if re.search(r'[.!?]$', k) or (re.search(r'[…,:—]$', k) and len(' '.join(cur)) >= 8): ch.append(' '.join(cur)); cur = []
    if cur: ch.append(' '.join(cur))
    return ch
seg = []
for i, b in enumerate(B, 1):
    s0, s1 = b['a'] + AWAL, b['b'] + AWAL
    kk = [(t, x) for t, x in kata if s0 - 0.35 <= t < s1 - 0.05] or [(s0, b['cap'])]
    cum = np.cumsum([0] + [suku(x) for _, x in kk]); cum = cum / cum[-1]
    ch = potong_teks(b['cap']); sc = np.cumsum([0] + [suku(x) for x in ch]); sc = sc / sc[-1]
    pt = []
    for k, x in enumerate(ch):
        j = int(np.argmin(np.abs(cum[:-1] - sc[k])))       # kata rekaman yang paling dekat dengan awal potongan ini
        t0 = max(s0 - 0.1, kk[j][0] - 0.1) if k else s0 - 0.1
        if pt: t0 = max(t0, pt[-1][0] + 0.4)
        pt.append([round(t0, 3), x])
    pt = [[t0, (pt[k + 1][0] - 0.05 if k + 1 < len(pt) else s1 + 0.15), x] for k, (t0, x) in enumerate(pt)]
    seg.append({'id': i, 'start': round(s0, 3), 'dur': round(s1 - s0, 3), 'cap': b['cap'], 'potong': [[round(p, 3), round(q, 3), x] for p, q, x in pt]})
hop = SR // FPS
amp = [float(np.sqrt(np.mean(track[f * hop:(f + 1) * hop] ** 2))) for f in range(int(total * FPS))]
mx = max(amp) or 1; amp = [round(v / mx, 3) for v in amp]
o = wave.open('vo_track.wav', 'wb'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR)
o.writeframes((np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes()); o.close()
json.dump({'fps': FPS, 'durasi': round(total, 3), 'segmen': seg, 'amp': amp}, open('timeline.json', 'w'), ensure_ascii=False)
print(f'durasi {total:.2f} detik, {len(seg)} baris')
