# Rapikan data peta (js/sidoarjo-data.js) ala arsitek: bukan peta persis, tapi rapi & masuk akal.
# - batas kabupaten dihaluskan (kantong/lekukan sempit di pesisir diisi) → tidak ada "pulau hutan" di laut
# - sungai kecil tanpa nama dibuang (sisa sungai bernama yang meliuk)
# - jalan: tidak keluar batas, tidak menyusuri sungai, tidak menembus perumahan/lahan/bandara, tanpa jalan dobel & buntu
# - semua kavling, lahan, bandara & wisata lumpur punya jalan masuk
# Pakai: python3 alat/rapikan-peta.py js/sidoarjo-data.js   (pip install shapely)
import json, math, sys
from shapely.geometry import Polygon, LineString, Point, box, MultiLineString
from shapely.ops import unary_union, linemerge, nearest_points, snap
from collections import defaultdict
F = sys.argv[1]; s = open(F).read(); kepala = s[:s.index('{')]
D = json.loads(s[s.index('{'):s.rindex('}') + 1])
KW, KD = 37, 54
LW = {'tol': 7, 'raya': 5, 'kabupaten': 3.6}
KELAS = {'tol': 3, 'raya': 2, 'kabupaten': 1}
def garis(g):
    if g.is_empty: return []
    if g.geom_type == 'LineString': return [g]
    if hasattr(g, 'geoms'): return [x for q in g.geoms for x in garis(q)]
    return []
def bulat(l): return [[round(x, 1), round(z, 1)] for x, z in l.coords]

# 1) batas: closing (isi lekukan sempit) + haluskan
P0 = Polygon(D['batas']).buffer(0)
P = P0.buffer(45, join_style=1).buffer(-45, join_style=1).simplify(2.5)
if P.geom_type != 'Polygon': P = max(P.geoms, key=lambda g: g.area)
D['batas'] = bulat(P.exterior)
DALAM = P.buffer(-8)

SUNGAI_ASLI = [x for x in D['sungai'] if x['n'] == '?']
# 2) sungai: hanya yang bernama, dipotong di sekitar batas, dan harus "bermuara" (ujungnya di tepi/laut atau di sungai lain)
sg = []
for x in D['sungai']:
    if x['n'] == '?': continue
    for q in garis(LineString(x['p']).intersection(P.buffer(18))):
        if q.length > 40: sg.append(dict(x, p=bulat(q)))
TEPI = P.exterior
for putaran in range(6):
    simpan = []
    for i, x in enumerate(sg):
        g = LineString(x['p']); ok = True
        lain = [LineString(o['p']) for n, o in enumerate(sg) if n != i]
        uj = [Point(g.coords[0]), Point(g.coords[-1])]
        nyambung = [u.distance(TEPI) < 25 or any(u.distance(o) < 4 for o in lain) for u in uj]
        if x['lebar'] >= 14 or any(nyambung): simpan.append(x)
    if len(simpan) == len(sg): break
    sg = simpan
D['sungai'] = sg
SUNGAI = [(LineString(x['p']), x['lebar']) for x in D['sungai']]

# 2b) kavling yang gapuranya (sisi +z) mepet kavling/lahan lain: geser supaya ada ruang ≥ 16 untuk jalan masuk
def kotak_kav(k, m=0): return box(k['x'] - KW / 2 - m, k['z'] - KD / 2 - m, k['x'] + KW / 2 + m, k['z'] + KD / 2 + m)
def kotak_lahan(l, m=0): return box(l['x'] - l['w'] / 2 - m, l['z'] - l['d'] / 2 - m, l['x'] + l['w'] / 2 + m, l['z'] + l['d'] / 2 + m)
JALAN0 = unary_union([LineString(j['p']) for j in D['jalan']])
def aman(k, i):
    b = kotak_kav(k, 3)
    if not P.buffer(-10).contains(b): return False
    if any(b.intersects(kotak_kav(o, 6)) for n, o in enumerate(D['kavling']) if n != i): return False
    if any(b.intersects(kotak_lahan(l, 6)) for l in D['lahan']): return False
    if any(b.intersects(l.buffer(L / 2 + 2)) for l, L in SUNGAI): return False
    return not b.intersects(JALAN0.buffer(4))
for i, k in enumerate(D['kavling']):
    depan = box(k['x'] - 6, k['z'] + KD / 2, k['x'] + 6, k['z'] + KD / 2 + 16)
    halang = [n for n, o in enumerate(D['kavling']) if n != i and depan.intersects(kotak_kav(o, 3))]
    if not halang: continue
    o = D['kavling'][halang[0]]; asal = (o['x'], o['z'])
    for dz, dx in [(dz, 0) for dz in range(4, 40, 2)] + [(0, dx) for dx in (-50, 50, -70, 70)] + [(dz, dx) for dz in (10, 20) for dx in (-30, 30)]:
        o['x'], o['z'] = asal[0] + dx, asal[1] + dz
        if aman(o, halang[0]) and not box(k['x'] - 6, k['z'] + KD / 2, k['x'] + 6, k['z'] + KD / 2 + 16).intersects(kotak_kav(o, 3)):
            print('kavling digeser', o['n'], asal, '->', (o['x'], o['z'])); break
    else: o['x'], o['z'] = asal; print('gagal geser', o['n'])

# 3) kotak terlarang (kavling, lahan, bandara)
kotak = [box(k['x'] - KW / 2 - 3, k['z'] - KD / 2 - 3, k['x'] + KW / 2 + 3, k['z'] + KD / 2 + 3) for k in D['kavling']]
kotak += [box(l['x'] - l['w'] / 2 - 3, l['z'] - l['d'] / 2 - 3, l['x'] + l['w'] / 2 + 3, l['z'] + l['d'] / 2 + 3) for l in D['lahan']]
if D.get('bandara'): kotak.append(Polygon(D['bandara']['p']).buffer(4))
# wisata lumpur: lahan bebas terdekat dari titik dekat Porong
def bebas_kotak(cx, cz, w, d, jalan_u):
    b = box(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2)
    if not DALAM.buffer(-6).contains(b): return False
    if any(b.intersects(k.buffer(6)) for k in kotak): return False
    if any(b.intersects(l.buffer(L / 2 + 6)) for l, L in SUNGAI): return False
    if any(b.intersects(LineString(r).buffer(6)) for r in D['rel']): return False
    return not b.intersects(jalan_u.buffer(6))

# 4) jalan
jalan = sorted(D['jalan'], key=lambda j: -KELAS.get(j['k'], 1))
korid_besar = unary_union([l.buffer(L / 2 + 7) for l, L in SUNGAI if L >= 14])
korid_kecil = unary_union([l.buffer(L / 2 + 4) for l, L in SUNGAI if L < 14])
terlarang = unary_union(kotak)
hasil, sudah = [], None
for j in jalan:
    g = LineString(j['p']).intersection(DALAM)
    g = g.difference(terlarang)
    for korid, lebar_max in ((korid_besar, 70), (korid_kecil, 26)):   # menyusuri sungai: buang; menyeberang (pendek): simpan
        luar = g.difference(korid); dalam_k = [x for x in garis(g.intersection(korid)) if x.length < lebar_max]
        g = unary_union(garis(luar) + dalam_k)
    if sudah is not None:   # dobel/menumpuk dengan jalan kelas lebih tinggi: buang bagian panjang yang menempel
        zona = sudah.buffer(LW[j['k']] / 2 + 4)
        luar = garis(g.difference(zona)); tempel = [x for x in garis(g.intersection(zona)) if x.length < 18]
        g = unary_union(luar + tempel)
    gs = garis(g)
    g = linemerge(MultiLineString(gs)) if len(gs) > 1 else (gs[0] if gs else g)
    for x in garis(g):
        if x.length >= (60 if j['k'] == 'tol' else 15): hasil.append({'k': j['k'], 'n': j.get('n', ''), 'g': x})
    sudah = unary_union([h['g'].buffer(0.01) for h in hasil]) if hasil else None
print('jalan setelah dipotong', len(hasil))
# --- kota (dibangun di world.js): jalan luar berhenti di tepi kota & disambung ke "pintu masuk" jalan kota
KOTA = unary_union([box(-32, -32, 32, 34), box(32, -86, 140, 19)])
PINTU = [(-32, -16), (-32, 0), (-32, 16), (32, 16), (-16, -32), (0, -32), (16, -32), (0, 34), (-16, 34), (16, 34),
         (140, 0), (62, -86), (100, -86), (34, -42), (136, -42), (62, 19), (100, 19)]
for h in hasil:
    h['g'] = h['g'].difference(KOTA.buffer(4))
hasil = [dict(h, g=x) for h in hasil for x in garis(h['g']) if x.length >= 12]
def jalur_ok(a, b, toleransi_sungai=70):
    L = LineString([a, b])
    if L.intersects(terlarang): return False
    if L.intersection(KOTA.buffer(-1)).length > 0.5: return False   # boleh menyusur tepi kota, tidak masuk ke dalam
    if L.intersects(korid_besar) and L.intersection(korid_besar).length > toleransi_sungai: return False
    return DALAM.buffer(2).contains(L)
semua = lambda: unary_union([h['g'] for h in hasil])
# 1) ujung dekat kota → pintu kota terdekat
dipakai = set()
for h in hasil:
    for i in (0, -1):
        p = Point(h['g'].coords[i])
        if p.distance(KOTA) > 90: continue
        if any(o is not h and o['g'].distance(p) < 1.5 for o in hasil): continue
        for d, q in sorted((p.distance(Point(q)), q) for q in PINTU):
            if d > 120: break
            if jalur_ok(p.coords[0], q):
                c = list(h['g'].coords); h['g'] = LineString([q] + c if i == 0 else c + [q]); dipakai.add(q); break
# pintu kota yang belum tersambung → jalan terdekat
for q in PINTU:
    if q in dipakai: continue
    U = semua(); t = nearest_points(Point(q), U)[1]
    if Point(q).distance(t) < 120 and jalur_ok(q, t.coords[0]): hasil.append({'k': 'raya', 'n': 'penyambung', 'g': LineString([q, t.coords[0]])}); dipakai.add(q)
# 2) ujung menggantung → jalan terdekat ≤ 45
for h in hasil:
    for i in (0, -1):
        p = Point(h['g'].coords[i])
        if any(o is not h and o['g'].distance(p) < 1.5 for o in hasil) or tuple(map(round, p.coords[0])) in PINTU: continue
        best = None
        for o in hasil:
            if o is h: continue
            q = nearest_points(p, o['g'])[1]; d = p.distance(q)
            if 1.5 <= d < 45 and (best is None or d < best[0]) and jalur_ok(p.coords[0], q.coords[0]): best = (d, q)
        if best:
            c = list(h['g'].coords); q = best[1].coords[0]; h['g'] = LineString([q] + c if i == 0 else c + [q])
# 3) graf: pecah di setiap simpang, pangkas ruas buntu berulang (kecuali pintu kota), ambil jaringan terbesar
kelas_ruas = []
for h in hasil:
    for x in garis(h['g']): kelas_ruas.append((x, h['k']))
import shapely
U0 = unary_union([x for x, _ in kelas_ruas])
kelas_ruas = [(shapely.set_precision(snap(x, U0, 1.0), 0.01), k) for x, k in kelas_ruas]   # ujung yang "menempel" benar-benar jadi simpang
noded = garis(unary_union([x for x, _ in kelas_ruas]))
def kelas_dari(seg):
    m = seg.interpolate(0.5, normalized=True); best = ('kabupaten', 1e9)
    for x, k in kelas_ruas:
        d = x.distance(m)
        if d < 0.6 and KELAS.get(k, 1) > KELAS.get(best[0], 0) or (d < best[1] and best[1] > 0.6): best = (k, d)
    return best[0]
ruas = [{'g': g, 'k': kelas_dari(g)} for g in noded if g.length > 0.5]
def kunci(pt): return (round(pt[0] * 2) / 2, round(pt[1] * 2) / 2)
PINTU_K = {kunci(q) for q in PINTU}
TEPI_B = P.exterior
def terminal(pt): return kunci(pt) in PINTU_K or Point(pt).distance(TEPI_B) < 14   # pintu kota / keluar kabupaten
for putaran in range(3):   # hanya pangkas "puntung" buntu yang pendek; cabang panjang tetap (melayani kavling lewat akses)
    deg = defaultdict(int)
    for r in ruas: deg[kunci(r['g'].coords[0])] += 1; deg[kunci(r['g'].coords[-1])] += 1
    buang = [r for r in ruas if (deg[kunci(r['g'].coords[0])] == 1 and not terminal(r['g'].coords[0])) or (deg[kunci(r['g'].coords[-1])] == 1 and not terminal(r['g'].coords[-1]))]
    buang = [r for r in buang if r['g'].length < 60]
    if not buang: break
    for r in buang: ruas.remove(r)
# komponen terbesar
induk = {}
def cari(u):
    while induk.setdefault(u, u) != u: induk[u] = induk[induk[u]]; u = induk[u]
    return u
for r in ruas: induk[cari(kunci(r['g'].coords[0]))] = cari(kunci(r['g'].coords[-1]))
pj = defaultdict(float)
for r in ruas: pj[cari(kunci(r['g'].coords[0]))] += r['g'].length
utama = max(pj, key=pj.get) if pj else None
ruas = [r for r in ruas if cari(kunci(r['g'].coords[0])) == utama or pj[cari(kunci(r['g'].coords[0]))] > 300]
# gabung lagi per kelas
D['jalan'] = []
for k in ('tol', 'raya', 'kabupaten'):
    gs = [r['g'] for r in ruas if r['k'] == k]
    if not gs: continue
    m = linemerge(MultiLineString(gs)) if len(gs) > 1 else gs[0]
    for x in garis(m): D['jalan'].append({'k': k, 'n': '', 'p': bulat(x.simplify(0.8))})
JU = unary_union([LineString(j['p']) for j in D['jalan']])
print('jalan akhir', len(D['jalan']), 'panjang', round(JU.length))

# 5) rel: di dalam batas, tidak menembus kotak
rel = []
for r in D['rel']:
    for x in garis(LineString(r).intersection(P.buffer(-4)).difference(terlarang)):
        if x.length > 25: rel.append(bulat(x))
D['rel'] = rel

# 6) wisata lumpur (dekat Porong)
W, Dd = 64, 54; lump = None
for k in range(900):
    a, r = k * 0.7, k * 1.4; cx, cz = -40 + math.cos(a) * r, 440 + math.sin(a) * r
    if bebas_kotak(cx, cz, W + 14, Dd + 24, JU): lump = (round(cx), round(cz)); break
D['lahan'] = [l for l in D['lahan'] if l.get('jenis') != 'lumpur']
if lump:
    D['lahan'].append({'nama': 'WISATA LUMPUR', 'sub': 'rencana wisata · tanggul lumpur Porong', 'x': lump[0], 'z': lump[1], 'w': W, 'd': Dd, 'jenis': 'lumpur'})
    kotak.append(box(lump[0] - W / 2 - 8, lump[1] - Dd / 2 - 8, lump[0] + W / 2 + 8, lump[1] + Dd / 2 + 18))
    terlarang = unary_union(kotak)
print('lumpur', lump)

# 7) jalan masuk: kavling (gapura di sisi +z), lahan (sisi +z), bandara (sisi selatan)
RIN = unary_union([l.buffer(L / 2 + 1) for l, L in SUNGAI] + [LineString(r).buffer(3) for r in D['rel']])
def sambung(x, z, abaikan, boleh_sungai=False, maks=260):
    lain = unary_union([k for i, k in enumerate(kotak) if i != abaikan])
    calon = []
    for g in [LineString(j['p']) for j in D['jalan']] + KOTA_JALAN:
        for t in range(0, int(g.length) + 1, 3):
            q = g.interpolate(t); calon.append((math.hypot(q.x - x, q.y - z), (round(q.x, 1), round(q.y, 1))))
    calon.sort()
    for d, q in calon:
        if d > maks: break
        L = LineString([(x, z), q])
        if L.intersects(lain): continue
        if not boleh_sungai and L.intersects(RIN): continue
        if not DALAM.buffer(2).contains(L): continue
        return q
    return None
# jalan pusat kota (dibuat di world.js) juga boleh jadi tujuan
KOTA_JALAN = [LineString(p) for p in ([[28, 0], [140, 0]], [[62, -82], [62, 19]], [[100, -82], [100, 19]], [[34, -42], [136, -42]])]
akses = []
titik = [(k['x'], k['z'] + KD / 2 + 1, i) for i, k in enumerate(D['kavling'])]
off = len(D['kavling'])
titik += [(l['x'], l['z'] + l['d'] / 2 + (16 if l.get('jenis') == 'lumpur' else 1), off + i) for i, l in enumerate(D['lahan'])]
if D.get('bandara'):
    bx = sum(p[0] for p in D['bandara']['p']) / len(D['bandara']['p']); bz = max(p[1] for p in D['bandara']['p'])
    titik.append((round(bx, 1), bz + 4, len(kotak) - (2 if lump else 1)))
for x, z, i in titik:
    q = sambung(x, z + 4, i) or sambung(x, z + 4, i, True) or sambung(x, z + 4, i, True, 600)
    if q: akses.append([[x, z], [x, z + 4], list(q)])
    else: print('tanpa akses', x, z)
D['akses'] = akses
# penyambung jalan pusat kota ke jaringan jalan
D['penyambung'] = []
print('akses', len(akses))
# 8) anak sungai panjang yang bermuara ke laut/tepi & tidak mengganggu: dikembalikan supaya pesisir tetap hidup
JB = unary_union([LineString(j['p']) for j in D['jalan']] + [LineString(a) for a in D['akses']])
KT = unary_union(kotak).buffer(10)
balik = 0
for x in SUNGAI_ASLI:
    for q in garis(LineString(x['p']).intersection(P.buffer(-6))):
        if q.length < 150 or q.intersects(KT): continue
        uj = [Point(q.coords[0]), Point(q.coords[-1])]
        if not any(u.distance(TEPI) < 30 for u in uj): continue
        silang = garis(q.intersection(JB.buffer(6)))
        if len(silang) > 3 or any(c.length > 25 for c in silang): continue
        if any(q.distance(LineString(o['p'])) < 12 and q.intersection(LineString(o['p']).buffer(12)).length > 40 for o in D['sungai']): continue
        D['sungai'].append(dict(x, p=bulat(q))); balik += 1
print('anak sungai dikembalikan', balik, 'total sungai', len(D['sungai']))
open(F, 'w').write(kepala + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('selesai', round(len(open(F).read()) / 1024), 'KB')
