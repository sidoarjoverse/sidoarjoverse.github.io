# Olah data OpenStreetMap Sidoarjo → js/sidoarjo-data.js (koordinat peta: 1 satuan = 20 m, pusat = alun-alun Sidoarjo, utara = -z)
import json, math, os, re, sys
D = sys.argv[1]; OUT = sys.argv[2]
LAT0, LON0, M = -7.4467, 112.7178, 20.0
KX = 111320 * math.cos(math.radians(7.45)) / M; KZ = 110574 / M
def xy(lat, lon): return (round((lon - LON0) * KX, 1), round((LAT0 - lat) * KZ, 1))
def muat(n):
    p = os.path.join(D, n + '.json')
    return json.load(open(p))['elements'] if os.path.exists(p) else []

def sederhana(pts, tol):   # Douglas-Peucker
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1e-9
    i, dm = 0, -1
    for k in range(1, len(pts) - 1):
        d = abs(dy * pts[k][0] - dx * pts[k][1] + b[0] * a[1] - b[1] * a[0]) / L
        if d > dm: i, dm = k, d
    if dm > tol: return sederhana(pts[:i + 1], tol)[:-1] + sederhana(pts[i:], tol)
    return [a, b]

def gabung(segs):   # sambung potongan garis jadi rantai panjang
    segs = [s[:] for s in segs if len(s) > 1]; out = []
    while segs:
        c = segs.pop(0); ubah = True
        while ubah:
            ubah = False
            for k, s in enumerate(segs):
                if s[0] == c[-1]: c += s[1:]
                elif s[-1] == c[-1]: c += s[::-1][1:]
                elif s[-1] == c[0]: c = s + c[1:]
                elif s[0] == c[0]: c = s[::-1] + c[1:]
                else: continue
                segs.pop(k); ubah = True; break
        out.append(c)
    return out

hasil = {}
# --- batas kabupaten
bt = [e for e in muat('batas') if e.get('tags', {}).get('name', '').lower().startswith('sidoarjo') or e.get('tags', {}).get('name') == 'Kabupaten Sidoarjo']
if bt:
    rel = max(bt, key=lambda e: len(e.get('members', [])))
    luar = [[(m['geometry'][k]['lat'], m['geometry'][k]['lon']) for k in range(len(m['geometry']))] for m in rel['members'] if m['type'] == 'way' and m.get('role') in ('outer', '') and 'geometry' in m]
    cin = max(gabung(luar), key=len)
    poly = [xy(a, b) for a, b in cin]
    h = len(poly) // 2
    hasil['batas'] = sederhana(poly[:h + 1], 2.5)[:-1] + sederhana(poly[h:], 2.5)[:-1]
    print('batas', len(cin), 'titik ->', len(hasil['batas']), 'rantai', len(gabung(luar)))
# --- kecamatan
kec = []
for e in muat('kec'):
    n = e.get('tags', {}).get('name', ''); c = e.get('center')
    if c and n: kec.append([re.sub(r'^Kecamatan ', '', n), *xy(c['lat'], c['lon'])])
KEC = [('Sidoarjo',-7.4467,112.7178),('Buduran',-7.4280,112.7230),('Candi',-7.4920,112.7130),('Porong',-7.5440,112.6950),('Krembung',-7.5160,112.6460),('Tulangan',-7.4800,112.6500),('Tanggulangin',-7.5090,112.6920),('Jabon',-7.5560,112.7650),('Krian',-7.4110,112.5810),('Balongbendo',-7.4040,112.5320),('Wonoayu',-7.4400,112.6250),('Tarik',-7.4300,112.4890),('Prambon',-7.4650,112.5780),('Taman',-7.3530,112.6870),('Waru',-7.3500,112.7400),('Gedangan',-7.3920,112.7270),('Sedati',-7.3900,112.7680),('Sukodono',-7.4000,112.6800)]
if not kec: kec = [[n, *xy(la, lo)] for n, la, lo in KEC]
hasil['kecamatan'] = kec
# --- sungai
sg = {}
for e in muat('sungai'):
    if 'geometry' not in e: continue
    n = e.get('tags', {}).get('name', '') or '?'; ww = e['tags'].get('waterway')
    sg.setdefault((n, ww), []).append([xy(p['lat'], p['lon']) for p in e['geometry']])
sungai = []
for (n, ww), segs in sg.items():
    for c in gabung(segs):
        c = sederhana(c, 1.5); panjang = sum(math.dist(c[i], c[i + 1]) for i in range(len(c) - 1))
        if panjang < 40: continue
        besar = bool(re.search(r'porong|brantas|surabaya|kali mas|kalimas', n, re.I))
        sungai.append({'n': n, 'lebar': 22 if 'orong' in n else 14 if besar else 5, 'p': [list(q) for q in c]})
hasil['sungai'] = sungai
# --- jalan
jl = []
for nama, kelas in (('jalan', None), ('jalan2', 'secondary')):
    gr = {}
    for e in muat(nama):
        if 'geometry' not in e: continue
        h = e['tags'].get('highway'); n = e['tags'].get('name', '') or e['tags'].get('ref', '')
        gr.setdefault((h, n), []).append([xy(p['lat'], p['lon']) for p in e['geometry']])
    for (h, n), segs in gr.items():
        for c in gabung(segs):
            c = sederhana(c, 1.2)
            if sum(math.dist(c[i], c[i + 1]) for i in range(len(c) - 1)) < 15: continue
            jl.append({'k': {'motorway': 'tol', 'trunk': 'raya', 'primary': 'raya', 'secondary': 'kabupaten'}.get(h, 'kabupaten'), 'n': n, 'p': c})
hasil['jalan'] = jl
# --- rel
rl = [[xy(p['lat'], p['lon']) for p in e['geometry']] for e in muat('rel') if 'geometry' in e]
hasil['rel'] = [sederhana(c, 1.5) for c in gabung(rl) if len(c) > 1]
# --- bandara
bd = [e for e in muat('bandara') if 'geometry' in e]
ae = [e for e in bd if e['tags'].get('aeroway') == 'aerodrome']
rw = [e for e in bd if e['tags'].get('aeroway') == 'runway']
if ae:
    a = max(ae, key=lambda e: len(e['geometry']))
    hasil['bandara'] = {'n': a['tags'].get('name', 'Bandara'), 'p': sederhana([xy(p['lat'], p['lon']) for p in a['geometry']], 1.5),
                        'landasan': [[xy(p['lat'], p['lon']) for p in e['geometry']] for e in rw]}
if 'bandara' not in hasil:   # cadangan: area Bandara Juanda (perkiraan) bila data OSM tidak terunduh
    hasil['bandara'] = {'n': 'Bandara Juanda', 'p': [xy(la, lo) for la, lo in [(-7.3700, 112.7600), (-7.3700, 112.8060), (-7.3920, 112.8060), (-7.3920, 112.7600)]],
                        'landasan': [[xy(-7.3800, 112.7660), xy(-7.3790, 112.7975)]]}
# --- perumahan (nama + titik tengah)
pr = []
for e in json.load(open(os.path.join(D, 'perum.json')))['elements']:
    c = e.get('center'); n = e['tags'].get('name', '')
    if c and n: pr.append([n, *xy(c['lat'], c['lon'])])
hasil['perumahan'] = pr
js = '// Data peta Sidoarjo asli (© kontributor OpenStreetMap, ODbL). Dibuat otomatis oleh alat pengolah; 1 satuan = 20 m, pusat = alun-alun Sidoarjo, utara = −z.\nexport const SDA = ' + json.dumps(hasil, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(OUT, 'w').write(js)
print({k: (len(v) if isinstance(v, list) else 'ok') for k, v in hasil.items()}, len(js) // 1024, 'KB')

# ---------- potong garis di luar kabupaten (sisakan 25 satuan di tepi: sungai/jalan perbatasan)
_P = hasil['batas']
def _dalam(x, z):
    d = False
    for i in range(len(_P)):
        xi, zi = _P[i]; xj, zj = _P[i - 1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi: d = not d
    return d
def _dekat(x, z, r=25):
    for i in range(len(_P)):
        (ax, az), (bx, bz) = _P[i - 1], _P[i]; dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz or 1
        t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / L2))
        if math.hypot(ax + dx * t - x, az + dz * t - z) < r: return True
    return False
def potong(p, lebih=False):   # lebih=True: sertakan 1 titik di luar supaya jalan menyeberangi sungai perbatasan
    out, cur, prev = [], [], None
    for q in p:
        if _dalam(*q) or _dekat(*q):
            if lebih and not cur and prev is not None: cur.append(prev)
            cur.append(q)
        else:
            if cur:
                if lebih: cur.append(q)
                if len(cur) > 1: out.append(cur)
            cur = []
        prev = q
    if len(cur) > 1: out.append(cur)
    return out
def panjang(p): return sum(math.dist(p[i], p[i + 1]) for i in range(len(p) - 1))
sg = []
for s in hasil['sungai']:
    for q in potong(s['p']):
        if s['n'] == '?': s2 = dict(s, lebar=3.5)
        else: s2 = s
        if panjang(q) >= (80 if s['n'] == '?' else 30): sg.append(dict(s2, p=q))
hasil['sungai'] = sg
jl = []
for j in hasil['jalan']:
    for q in potong(j['p'], True):
        if panjang(q) >= 12: jl.append(dict(j, p=q))
hasil['jalan'] = jl
hasil['rel'] = [q for p in hasil['rel'] for q in potong(p) if panjang(q) > 20]
print('setelah dipotong: sungai', len(sg), 'jalan', len(jl))

# ---------- rapikan jaringan jalan: buang dobel, sambung ujung yang menggantung, buang potongan pendek
KELAS = {'tol': 3, 'raya': 2, 'kabupaten': 1}
def titik_terdekat(x, z, p):
    best, bp = 1e18, None
    for k in range(len(p) - 1):
        (ax, az), (bx, bz) = p[k], p[k + 1]; dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz or 1
        t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / L2)); qx, qz = ax + dx * t, az + dz * t; d = math.hypot(qx - x, qz - z)
        if d < best: best, bp = d, [round(qx, 1), round(qz, 1)]
    return best, bp
jl = sorted(hasil['jalan'], key=lambda j: (-KELAS.get(j['k'], 1), -panjang(j['p'])))
bersih = []
for j in jl:   # buang ruas yang (hampir) seluruhnya menumpuk di jalan lain yang sudah ada
    pts = j['p']; dobel = 0
    for x, z in pts:
        if any(titik_terdekat(x, z, o['p'])[0] < 3 for o in bersih): dobel += 1
    if dobel >= len(pts) - 1 and len(pts) <= 3 or dobel >= 0.8 * len(pts): continue
    bersih.append(j)
def dekat_tepi(x, z): return _dekat(x, z, 30) or not _dalam(x, z)
for j in bersih:   # ujung menggantung → sambung ke jalan lain terdekat (≤ 45 satuan)
    for ujung in (0, -1):
        x, z = j['p'][ujung]
        if dekat_tepi(x, z): continue
        if any(o is not j and titik_terdekat(x, z, o['p'])[0] < 2.5 for o in bersih): continue
        best = (1e18, None)
        for o in bersih:
            if o is j: continue
            d, q = titik_terdekat(x, z, o['p'])
            if d < best[0]: best = (d, q)
        if best[0] < 45:
            if ujung == 0: j['p'].insert(0, best[1])
            else: j['p'].append(best[1])
        else: j['buntu'] = j.get('buntu', 0) + 1
for j in bersih: j.pop('buntu', None)
# pangkas ujung buntu: potong mundur sampai simpang terdekat; jalan buntu tanpa simpang dibuang
def tersambung(x, z, j): return any(o is not j and titik_terdekat(x, z, o['p'])[0] < 3 for o in bersih)
for putaran in range(4):
    baru = []
    for j in bersih:
        p = j['p']
        for sisi in (0, 1):
            if sisi: p = p[::-1]
            if dekat_tepi(*p[0]) or tersambung(*p[0], j): p = p if not sisi else p[::-1]; continue
            k = next((i for i in range(1, len(p)) if tersambung(*p[i], j)), None)
            p = p[k:] if k is not None and k < len(p) - 1 else []
            if sisi and p: p = p[::-1]
            if not p: break
        if len(p) > 1 and panjang(p) > 8: j['p'] = p; baru.append(j)
    bersih = baru

print('jalan dirapikan', len(hasil['jalan']), '->', len(bersih))
hasil['jalan'] = bersih
# sungai: buang anak sungai tanpa nama yang sangat pendek / menumpuk
hasil['sungai'] = [s for s in hasil['sungai'] if s['n'] != '?' or panjang(s['p']) >= 120]

# ---------- penempatan kavling perumahan (25, letak asli, digeser bila bertabrakan) & lahan rencana
KW, KD = 37, 54
TARGET = [('Safira Garden', -153, -231), ('Pondok Jati', -93, -19), ('Taman Pinang Indah', -59, 38), ('Pondok Mutiara', -125, 12), ('Puri Surya Jaya', 86, -295),
 ('Gading Fajar', 47, -89), ('Deltasari Indah', 92, -461), ('Pondok Tjandra Indah', 299, -601), ('Sidokare Indah', -41, 96), ('Magersari Permai', 23, 85),
 ('Kahuripan Nirwana', -148, -54), ('Bumi Citra Fajar', -82, 118), ('Griya Candramas', 304, -257), ('Wisma Tropodo', 228, -496), ('Citra Harmoni', -319, -452),
 ('Graha Kota', -198, 29), ('Mutiara Citra Graha', -10, 162), ('Puri Indah', -153, 46), ('Pucang Indah', 2, -40), ('Taman Anggun Sejahtera', 84, -54),
 ('Candiloka', -71, 212), ('Pondok Wage Indah', -55, -459), ('Bluru Permai', 95, 101), ('Juanda Harapan Permai', 168, -350), ('Taman Jenggala', 56, 129)]
POLY = hasil.get('batas', [])
def dalam(x, z):
    d = False; n = len(POLY)
    for i in range(n):
        xi, zi = POLY[i]; xj, zj = POLY[i - 1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi: d = not d
    return d
def jarak_garis(x, z, p):
    best = 1e18
    for k in range(len(p) - 1):
        (ax, az), (bx, bz) = p[k], p[k + 1]; dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz or 1
        t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / L2)); best = min(best, math.hypot(ax + dx * t - x, az + dz * t - z))
    return best
garis = [(s['p'], s['lebar'] / 2 + 5) for s in hasil['sungai']] + [(j['p'], {'tol': 7, 'raya': 6, 'kabupaten': 5}.get(j['k'], 5)) for j in hasil['jalan']] + [(p, 13) for p in hasil['rel']]
KOTA = [(-40, 40, -40, 42), (28, 150, -95, 27)]   # kota lama & pusat kota + pinggiran
dipakai = []
bd = hasil.get('bandara', {}).get('p', [])
def di_bandara(x, z):
    d = False
    for i in range(len(bd)):
        xi, zi = bd[i]; xj, zj = bd[i - 1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi: d = not d
    return d
def seg_kotak(ax, az, bx, bz, x0, x1, z0, z1):   # apakah ruas garis memotong kotak
    if max(ax, bx) < x0 or min(ax, bx) > x1 or max(az, bz) < z0 or min(az, bz) > z1: return False
    if x0 <= ax <= x1 and z0 <= az <= z1 or x0 <= bx <= x1 and z0 <= bz <= z1: return True
    def silang(p, q, r, t):
        d = (q[0] - p[0]) * (t[1] - r[1]) - (q[1] - p[1]) * (t[0] - r[0])
        if d == 0: return False
        u = ((r[0] - p[0]) * (t[1] - r[1]) - (r[1] - p[1]) * (t[0] - r[0])) / d; v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d
        return 0 <= u <= 1 and 0 <= v <= 1
    A, B = (ax, az), (bx, bz)
    return any(silang(A, B, r, t) for r, t in [((x0, z0), (x1, z0)), ((x1, z0), (x1, z1)), ((x1, z1), (x0, z1)), ((x0, z1), (x0, z0))])
def kena_garis(x0, x1, z0, z1):
    for p, r in garis:
        for k in range(len(p) - 1):
            if seg_kotak(*p[k], *p[k + 1], x0 - r, x1 + r, z0 - r, z1 + r): return True
    return False
JALAN_BIASA = [j['p'] for j in hasil['jalan'] if j['k'] != 'tol']
def bebas(x, z, w, d, celah=8, butuh_jalan=True):
    x0, x1, z0, z1 = x - w / 2, x + w / 2, z - d / 2, z + d / 2 + 6
    pts = [(x + u * w / 2, z + v * d / 2) for u in (-1, 0, 1) for v in (-1, 0, 1)]
    if not all(_dalam(px, pz) and not _dekat(px, pz, 20) for px, pz in pts): return False
    for (a, b, c, e) in KOTA:
        if x1 > a and x0 < b and z1 > c and z0 < e: return False
    for (ox, oz, ow, od) in dipakai:
        if abs(x - ox) < (w + ow) / 2 + celah and abs(z - oz) < (d + od) / 2 + celah: return False
    if any(di_bandara(px, pz) for px, pz in pts): return False
    if kena_garis(x0, x1, z0, z1): return False
    if butuh_jalan and min(titik_terdekat(x, z1 + 2, p)[0] for p in JALAN_BIASA) > 70: return False   # dekat jalan supaya jalan masuknya pendek
    return True
def cari(x0, z0, w, d, wajib=True):
    if bebas(x0, z0, w, d): return (x0, z0)
    for rad in range(6, 900, 6):
        for k in range(max(8, rad // 3)):
            a = 2 * math.pi * k / max(8, rad // 3); x, z = round(x0 + rad * math.cos(a)), round(z0 + rad * math.sin(a))
            if bebas(x, z, w, d): return (x, z)
    print('TIDAK DAPAT TEMPAT', x0, z0, w, d)
    return (x0, z0) if wajib else None
kav = []
for n, x, z in TARGET:
    px, pz = cari(x, z, KW, KD); dipakai.append((px, pz, KW, KD)); kav.append({'n': n, 'x': px, 'z': pz, 'asli': [x, z]})
hasil['kavling'] = kav
def xyz(lat, lon): return xy(lat, lon)
LAHAN = [('LAHAN STASIUN', 'rencana stasiun kereta api', (-7.4466, 112.7175), 30, 50),
 ('LAHAN TERMINAL BUS', 'rencana terminal antarkota (Purabaya)', (-7.3510, 112.7240), 40, 36),
 ('LAHAN KAMPUS', 'rencana universitas', (-7.4580, 112.6950), 70, 50),
 ('LAHAN MAL', 'rencana mal & pusat belanja', (-7.4390, 112.7080), 60, 50),
 ('LAHAN STADION', 'rencana stadion (Gelora Delta)', (-7.4505, 112.7086), 56, 44),
 ('LAHAN RUMAH SAKIT', 'rencana rumah sakit daerah', (-7.4563, 112.7006), 50, 40),
 ('LAHAN PELABUHAN', 'rencana pelabuhan ikan', (-7.4300, 112.8350), 34, 40)]
lahan = []
for nama, sub, (la, lo), w, d in LAHAN:
    x, z = xyz(la, lo); t = cari(x, z, w, d, wajib=False)
    if not t or math.hypot(t[0] - x, t[1] - z) > 480: print('lahan dibuang', nama); continue
    px, pz = t; dipakai.append((px, pz, w, d)); lahan.append({'nama': nama, 'sub': sub, 'x': px, 'z': pz, 'w': w, 'd': d})
hasil['lahan'] = lahan
# jalan masuk perumahan & penyambung jalan kota: lurus ke titik jalan terdekat yang tidak melewati kavling/sungai/rel
KOTAK = [(k['x'] - KW / 2 - 1, k['x'] + KW / 2 + 1, k['z'] - KD / 2 - 1, k['z'] + KD / 2 + 1) for k in kav] + [(l['x'] - l['w'] / 2, l['x'] + l['w'] / 2, l['z'] - l['d'] / 2, l['z'] + l['d'] / 2) for l in lahan]
RINTANG = [(s['p'], s['lebar'] / 2 + 1) for s in hasil['sungai']] + [(p, 3) for p in hasil['rel']]
def lewat_rintang(a, b, abaikan=None, boleh_sungai=False):
    for i, (x0, x1, z0, z1) in enumerate(KOTAK):
        if i == abaikan: continue
        if seg_kotak(*a, *b, x0, x1, z0, z1): return True
    for p, r in (RINTANG[-len(hasil['rel']):] if boleh_sungai and hasil['rel'] else [] if boleh_sungai else RINTANG):
        for k in range(len(p) - 1):
            (cx, cz), (dx, dz) = p[k], p[k + 1]
            # silang dua ruas
            den = (b[0] - a[0]) * (dz - cz) - (b[1] - a[1]) * (dx - cx)
            if den == 0: continue
            u = ((cx - a[0]) * (dz - cz) - (cz - a[1]) * (dx - cx)) / den; v = ((cx - a[0]) * (b[1] - a[1]) - (cz - a[1]) * (b[0] - a[0])) / den
            if 0 <= u <= 1 and 0 <= v <= 1: return True
    return False
def sambung(x, z, abaikan=None, maks=200, boleh_sungai=False):
    calon = []
    for p in JALAN_BIASA:
        for k in range(len(p) - 1):
            (ax, az), (bx, bz) = p[k], p[k + 1]
            for t in [i / 8 for i in range(9)]:
                qx, qz = ax + (bx - ax) * t, az + (bz - az) * t; calon.append((math.hypot(qx - x, qz - z), [round(qx, 1), round(qz, 1)]))
    for d, q in sorted(calon):
        if d > maks: break
        if not lewat_rintang((x, z), q, abaikan, boleh_sungai): return q
    return None
akses = []
for i, k in enumerate(kav):
    gx, gz = k['x'], k['z'] + KD / 2 + 1
    q = sambung(gx, gz + 4, abaikan=i) or sambung(gx, gz + 4, abaikan=i, maks=500, boleh_sungai=True)
    if q: akses.append([[gx, gz], [gx, gz + 4], q])
hasil['akses'] = akses
pny = []
for x, z in [[-28, 0], [0, 31], [140, 0], [62, -84], [100, -84], [62, 19], [100, 19]]:
    q = sambung(x, z, maks=150) or sambung(x, z, maks=300, boleh_sungai=True)
    if q: pny.append([[x, z], q])
hasil['penyambung'] = pny
print('akses', len(akses), 'penyambung', len(pny))
js = '// Data peta Sidoarjo asli (© kontributor OpenStreetMap, ODbL). Dibuat otomatis oleh alat pengolah; 1 satuan = 20 m, pusat = alun-alun Sidoarjo, utara = −z.\nexport const SDA = ' + json.dumps(hasil, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(OUT, 'w').write(js)
print('kavling', [(k['n'], k['x'], k['z']) for k in kav]); print('lahan', [(l['nama'], l['x'], l['z']) for l in lahan]); print(len(js) // 1024, 'KB')
