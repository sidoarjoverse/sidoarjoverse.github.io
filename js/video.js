// Perender video vertikal 9:16 SidoarjoVerse, frame demi frame (dipanggil dari Playwright).
// Semua adegan dibaca dari naskah.json (kamera, pose, stiker, efek suara per baris).
// Pakai: video.html?dir=video/<nama>&skala=1.5
import * as THREE from 'three';
import { createWorld, makeCakDarjo, makeAyam, buatAkuarium, makeCharUmum, rng } from './world.js';
import { adeganRumah } from './rumah.js';

const W = 720, H = 1280;
const q = new URLSearchParams(location.search);
const SKALA = +(q.get('skala') || 1);
const DIR = q.get('dir') || 'video/kenalan';
const ambil = async f => (await fetch(`${DIR}/${f}`, { cache: 'no-store' })).json();
const NASKAH = await ambil('naskah.json');
const TL = await ambil('timeline.json');
const FPS = TL.fps, N = Math.round(TL.durasi * FPS);
// Subtitle = persis yang diucapkan (ejaan mesin suara dirapikan); kata kunci dikapital agar disorot.
const SOROT = ['warga', 'ktp', 'follow', 'komen', 'like'];
function rapikan(tts) {
  return tts.replace(/Sidoarjo Vers titik GitHub titik io/gi, 'sidoarjoverse.github.io').replace(/Sidoarjo Vers/g, 'SidoarjoVerse').replace(/P\. O\. V\./g, 'POV').replace(/\.\.\./g, '…')
    .split(' ').map(k => SOROT.includes(k.replace(/[^A-Za-z]/g, '').toLowerCase()) ? k.toUpperCase() : k).join(' ');
}
// gambar untuk stiker "layar" (tangkapan layar website) dimuat dulu
const GAMBAR = {};
await Promise.all(NASKAH.baris.flatMap(b => (b.stiker || []).filter(x => x.jenis === 'layar')).map(x => new Promise(ok => {
  const im = new Image(); im.onload = () => { GAMBAR[x.gambar] = im; ok(); }; im.onerror = ok; im.src = `${DIR}/${x.gambar}`;
})));
const SEG = TL.segmen.map((s, i) => {
  const b = NASKAH.baris[i];
  return Object.assign({}, s, b, { cap: b.subtitle_khusus ? s.cap : rapikan(b.tts) });
});
const n = SEG.length;
const mulai = i => (i === 0 ? 0 : SEG[i - 1].start + SEG[i - 1].dur);          // adegan i mulai saat baris sebelumnya selesai
const selesai = i => (i === n - 1 ? TL.durasi : mulai(i + 1));
const segPada = t => { for (let i = n - 1; i >= 0; i--) if (t >= mulai(i)) return i; return 0; };

// ------------------------------------------------------------ dunia
const kota = await (await fetch('data/kota.json', { cache: 'no-store' })).json();
Object.assign(kota, { day: 0, jalan: false, ayam: 0 }, NASKAH.kota || {});
if (!NASKAH.kota || !NASKAH.kota.bangunan) kota.bangunan = [{ id: 'lahan1', nama: '???', tipe: 'lapangan', x: -8, z: -8, rot: 0, status: 'lahan', progres: 0 }];
const gl = document.getElementById('gl');
const world = createWorld(gl, { manual: true });
world.setKota(kota);
world.setWarga(NASKAH.warga || [], NASKAH.kamu || '');
world.maskot().g.visible = false;
world.setJam(NASKAH.jam ?? 9.3);
if (NASKAH.kabut) world.setKabut(NASKAH.kabut);
const { scene, camera, renderer } = world;
renderer.setPixelRatio(SKALA);
renderer.setSize(W, H, false);
camera.fov = 40; camera.aspect = W / H; camera.updateProjectionMatrix();

const darjo = makeCakDarjo(NASKAH.darjoOpt || {});   // mis. {"helm": "#ffd166"} → Cak Darjo jadi mandor
const senter = new THREE.SpotLight('#fff3d0', 0, 16, 0.32, 0.5, 1.2); senter.position.set(0.35, 1.25, 0.3); darjo.add(senter); darjo.add(senter.target); senter.target.position.set(0.2, 0.2, 6);
const lampuDarjo = new THREE.PointLight('#ffe7c2', 0, 9, 1.4); lampuDarjo.position.set(0.9, 2.7, 3.4); scene.add(lampuDarjo);   // lampu muka Cak Darjo saat malam
darjo.position.set(0, 0, 0.6);
scene.add(darjo);
const tangan = darjo.children.find(c => c.isGroup && c.position.x > 0.3 && c.position.y > 1.1);
const tanganAwal = tangan.rotation.clone();
const gunting = new THREE.Group(); { const m = new THREE.MeshStandardMaterial({ color: '#d9d9d9', metalness: 0.8, roughness: 0.25 }), h = new THREE.MeshStandardMaterial({ color: '#e63946' });
  for (const s of [-1, 1]) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.012), m); bl.position.set(s * 0.03, -0.25, 0); bl.rotation.z = s * 0.28; gunting.add(bl); const og = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), h); og.position.set(s * 0.06, 0, 0); gunting.add(og); }
  gunting.position.set(0, -0.55, 0.05); gunting.visible = false; tangan.add(gunting); }
// ikan di sungai (naskah "iwak": [{x, z, arah, n, sebar, panjang}]) — berenang di permukaan & sesekali melompat
const IWAK = [];
for (const k of NASKAH.iwak || []) {
  const r = rng('iwak' + k.x + k.z);
  for (let j = 0; j < (k.n || 20); j++) {
    const g = new THREE.Group(), warna = ['#8a8f96', '#c97b3a', '#6f7f6a', '#b5b9be', '#d4a03a'][Math.floor(r() * 5)], m = new THREE.MeshStandardMaterial({ color: warna, roughness: 0.4, metalness: 0.3 });
    const badan = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m); badan.scale.set(0.55, 0.5, 1.5); g.add(badan);
    const ekor = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 4), m); ekor.rotation.x = -Math.PI / 2; ekor.scale.set(1, 1, 0.3); ekor.position.z = -0.42; g.add(ekor);
    const sirip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 3), m); sirip.position.set(0, 0.12, 0.02); g.add(sirip);
    const sk = (k.besar ?? 2) * (0.8 + r() * 0.7); g.scale.setScalar(sk); scene.add(g);
    IWAK.push({ g, k, ph: r() * 6.28, sp: 0.25 + r() * 0.35, off: (r() - 0.5) * 2 * (k.sebar ?? 7), span: (k.panjang ?? 14) * (0.4 + r() * 0.6), lompat: r() < 0.35, tl: 2 + r() * 5, ekor });
  }
}
// warga mancing (naskah "pemancing": [{x, y, z, ry}]), joran + senar + pelampung; baris "pemancingToleh": true → menoleh ke kamera
const PEMANCING = (NASKAH.pemancing || []).map((d, k) => {
  const ch = makeCharUmum({ kulit: '#b9805a', baju: ['#4f772d', '#3a5a8c'][k % 2], celana: '#3d405b', rambut: '#1a1a1a' }, { topi: '#d9c38a' });
  ch.position.set(d.x, d.y || 0, d.z); ch.rotation.y = (d.ry || 0) + (d.balik ? Math.PI : 0); scene.add(ch);
  const m = new THREE.MeshStandardMaterial({ color: '#5a3e24', roughness: 0.6 });
  const joran = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 3.2, 6), m); joran.position.set(0.3, 1.9, 1.3); joran.rotation.x = 1.0; ch.add(joran);
  const ujung = new THREE.Vector3(0.3, 2.75, 2.65), ap = (d.y || 0) - (d.air ?? 0.12);
  const senar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), new THREE.MeshBasicMaterial({ color: '#eeeeee' })); ch.add(senar);
  const pelampung = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: '#e63946' })); ch.add(pelampung);
  return { ch, d, ujung, ap, senar, pelampung, joran };
});
function aturPemancing(t, s) {
  for (const p of PEMANCING) {
    const goy = Math.sin(t * 1.3 + p.d.x) * 0.04; p.joran.rotation.x = 1.0 + goy;
    const tip = p.ujung.clone(); tip.y += goy * 1.5; const bawah = new THREE.Vector3(tip.x, -p.ap + Math.sin(t * 2.1) * 0.03, tip.z + 0.6);
    p.senar.position.copy(tip).add(bawah).multiplyScalar(0.5); p.senar.scale.y = tip.distanceTo(bawah); p.senar.lookAt(p.ch.localToWorld(bawah.clone())); p.senar.rotateX(Math.PI / 2);
    p.pelampung.position.copy(bawah);
    const head = p.ch.userData.anim && p.ch.userData.anim.head;
    if (head) head.rotation.y = s.pemancingToleh ? Math.min(1.2, (t - s.start) * 3) * (p.d.tolehArah ?? 1) : 0;
  }
}
// penonton (naskah "penonton": {n, cx, cz, r0, r1, a0, a1}) — warga berdiri melingkar menghadap pusat, sebagian bersorak
const PENONTON = [];
for (const P of [].concat(NASKAH.penonton || [])) {
  const r = rng('penonton' + P.a0), KULIT = ['#f1c6a0', '#e0ac85', '#c98d5a', '#a8714a', '#8d5a3a'], BAJU = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#9b5de5', '#ffd166', '#06d6a0', '#ef476f', '#3d405b', '#ffffff'], RAMBUT = ['#1a1a1a', '#2b1d14', '#3b2a1e'];
  for (let k = 0; k < (P.n || 120); k++) {
    const a = (P.a0 ?? -1.2) + r() * ((P.a1 ?? 1.2) - (P.a0 ?? -1.2)), rr = (P.r0 ?? 6) + Math.sqrt(r()) * ((P.r1 ?? 16) - (P.r0 ?? 6));
    const x = P.cx + Math.sin(a) * rr, z = P.cz + Math.cos(a) * rr;
    const ch = makeCharUmum({ kulit: KULIT[Math.floor(r() * 5)], baju: BAJU[Math.floor(r() * 10)], celana: ['#3d405b', '#1d3557', '#5c4033'][Math.floor(r() * 3)], rambut: RAMBUT[Math.floor(r() * 3)], ...(r() < 0.4 ? { kerudung: BAJU[Math.floor(r() * 10)] } : {}) });
    ch.position.set(x, 0, z); ch.rotation.y = Math.atan2(P.cx - x, P.cz - z) + (r() - 0.5) * 0.5; ch.scale.setScalar(0.92 + r() * 0.16); scene.add(ch);
    const lengan = (ch.userData.anim && ch.userData.anim.arms) || [];
    PENONTON.push({ ch, lengan, sorak: r() < 0.55, ph: r() * 6.28 });
  }
}
function aturPenonton(t) {
  for (const p of PENONTON) {
    p.ch.position.y = p.sorak ? Math.abs(Math.sin(t * 6 + p.ph)) * 0.12 : 0;
    if (p.sorak) p.lengan.forEach(l => l.rotation.set(0, 0, Math.sign(l.position.x || 1) * (2.5 + Math.sin(t * 9 + p.ph) * 0.3)));
  }
}
// pita peresmian (naskah "pita": {x, z, lebar, putus}) + gunting di tangan Cak Darjo (pose "gunting")
let PITA = null;
if (NASKAH.pita) {
  const P = NASKAH.pita, g = new THREE.Group(); g.position.set(P.x, 0, P.z);
  const tiang = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.6, roughness: 0.3 }), merah = new THREE.MeshStandardMaterial({ color: '#d62828', roughness: 0.5 });
  for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.35, 10), tiang); t.position.set(sx * P.lebar / 2, 0.675, 0); g.add(t); const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), tiang); b.position.set(sx * P.lebar / 2, 1.38, 0); g.add(b); }
  const sisi = (sx) => { const L = P.lebar / 2 - (P.putus ? 0.25 : 0), m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.16, 0.03), merah); m.position.set(sx * (P.lebar / 2 - L / 2), P.putus ? 1.05 : 1.25, 0); if (P.putus) m.rotation.z = sx * 0.35; g.add(m); };
  sisi(-1); sisi(1);
  if (!P.putus) { const pita = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 16), merah); pita.position.set(0, 1.25, 0.02); g.add(pita); }
  scene.add(g); PITA = g;
}
function aturIwak(t) {
  for (const f of IWAK) {
    const { k } = f, a = k.arah || 0, dx = Math.sin(a), dz = Math.cos(a), u = Math.sin(t * f.sp + f.ph), du = Math.cos(t * f.sp + f.ph);
    const x = k.x + dx * u * f.span + dz * f.off, z = k.z + dz * u * f.span - dx * f.off;
    let y = (k.y ?? 0.1), rx = 0;
    if (f.lompat) { const per = f.tl + 3, w = ((t + f.ph * 3) % per); if (w < 0.9) { const q = w / 0.9; y += Math.sin(q * Math.PI) * 1.3; rx = (q - 0.5) * 2.2; } }
    f.g.position.set(x, y, z); f.g.rotation.set(rx, Math.atan2(dx * du, dz * du), 0);
    f.ekor.rotation.y = Math.sin(t * 9 + f.ph) * 0.5;
  }
}
const ayam = makeAyam(() => 0.2);
ayam.position.set(1.35, 0, 1.9); ayam.rotation.y = -0.7;
scene.add(ayam);
// akuarium sesaat (baris dengan "prop": "akuarium")
const akua = buatAkuarium(); akua.group.scale.setScalar(0.85); akua.group.visible = false; darjo.add(akua.group);
akua.group.position.set(0, 1.12, 0.58);
const tanganKiri = darjo.children.find(c => c.isGroup && c.position.x < -0.3 && c.position.y > 1.1);
// HP di tangan Cak Darjo (pose "hp": melihat layar HP)
const hp = new THREE.Group(); hp.visible = false; darjo.add(hp);
{
  const badan = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.66, 0.05), new THREE.MeshStandardMaterial({ color: '#1d2228', roughness: 0.4 })); hp.add(badan);
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 300; const g = cv.getContext('2d');
  g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, 160, 300);
  g.fillStyle = '#0f4c5c'; g.fillRect(0, 0, 160, 34);
  for (let k = 0; k < 5; k++) { g.fillStyle = ['#f4a261', '#2a9d8f', '#e76f51', '#8d5a97', '#e9c46a'][k]; g.beginPath(); g.arc(22, 58 + k * 50, 12, 0, 7); g.fill(); g.fillStyle = '#c9d1d9'; g.fillRect(42, 50 + k * 50, 100, 8); g.fillRect(42, 64 + k * 50, 70, 8); g.fillStyle = '#e63946'; g.fillRect(124, 64 + k * 50, 18, 8); }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const layar = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.6), new THREE.MeshBasicMaterial({ map: tx })); layar.position.z = 0.027; hp.add(layar);
  hp.position.set(-0.32, 1.42, 0.62); hp.rotation.set(-0.55, 0.35, 0.05);
}
const kiriAwal = tanganKiri ? tanganKiri.rotation.clone() : null;
const tongkat = tanganKiri ? tanganKiri.children.find(c => c.isGroup) : null;   // tongkat komando di tangan kiri
// tukang bangunan (naskah: "tukang": "<id bangunan>")
let tukang = null;
if (NASKAH.tukang) {
  const bt = kota.bangunan.find(b => b.id === NASKAH.tukang);
  if (bt) {
    tukang = makeCharUmum({ kulit: '#c98d5a', baju: '#f28c28', celana: '#3d405b', rambut: '#1a1a1a' }, { helm: '#ffd166' });
    tukang.position.set(+bt.x - 5.6, 0, +bt.z + 2.2); tukang.rotation.y = 1.4; scene.add(tukang);
  }
}
const lahanB = kota.bangunan.find(b => b.status === 'lahan') || { x: -8, z: -8 };
const sorot = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.5, 7.2), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.5, depthWrite: false }));
sorot.position.set(+lahanB.x, 0.25, +lahanB.z); sorot.visible = false; scene.add(sorot);
sorot.add(new THREE.LineSegments(new THREE.EdgesGeometry(sorot.geometry), new THREE.LineBasicMaterial({ color: '#f28c28' })));

// Cak Darjo "pojok": dirender terpisah (latar transparan) lalu ditempel di pojok kanan bawah saat shot udara
const PW = 300, PH = 430;
const rPojok = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
rPojok.outputColorSpace = THREE.SRGBColorSpace; rPojok.toneMapping = THREE.ACESFilmicToneMapping; rPojok.toneMappingExposure = 1.12;
rPojok.setPixelRatio(SKALA); rPojok.setSize(PW, PH, false); rPojok.setClearColor(0x000000, 0);
const scPojok = new THREE.Scene();
scPojok.add(new THREE.HemisphereLight('#e4eef2', '#9a9070', 1.7));
{ const sun = new THREE.DirectionalLight('#ffe3bd', 2.3); sun.position.set(2, 4, 5); scPojok.add(sun); }
const camPojok = new THREE.PerspectiveCamera(30, PW / PH, 0.1, 50);
camPojok.position.set(0.2, 1.75, 4.1); camPojok.lookAt(0, 1.6, 0);

// papan yang diangkat Cak Darjo (pose "angkat-papan", naskah "papan": "BARIS1|BARIS2")
const papanAngkat = new THREE.Group(); papanAngkat.visible = false; darjo.add(papanAngkat);
{
  const baris = (NASKAH.baris.find(b => b.papan) || {}).papan || '';
  const [a1, a2] = baris.split('|');
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d');
  g.fillStyle = '#fff8ea'; g.beginPath(); g.roundRect(8, 8, 624, 344, 40); g.fill();
  g.lineWidth = 14; g.strokeStyle = '#f28c28'; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#0f4c5c'; g.font = '900 170px "DejaVu Sans", sans-serif'; g.fillText(a1 || '', 320, 150);
  g.fillStyle = '#f28c28'; g.font = '800 54px "DejaVu Sans", sans-serif'; g.fillText(a2 || '', 320, 285);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.96), new THREE.MeshBasicMaterial({ map: tx }));
  pl.position.set(0, 3.0, 0.25); papanAngkat.add(pl);
  for (const x of [-0.62, 0.62]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9), new THREE.MeshStandardMaterial({ color: '#8d6e4a' })); k.position.set(x, 2.55, 0.2); papanAngkat.add(k); }
}

// warga "@kamu" + beberapa tetangga dipasang diam di satu titik untuk kamera "warga"
const TITIK_W = new THREE.Vector3(-5, 0, 2);
const kodeDari = ch => ch.g.userData.pick && ch.g.userData.pick.data && ch.g.userData.pick.data.kode;
const semua = world.karakter().filter(ch => ch !== world.maskot());
const kamu = semua.find(ch => kodeDari(ch) === NASKAH.kamu);
const tetangga = semua.filter(ch => ch !== kamu).slice(0, 4);
const pasang = (ch, x, z, ry) => { ch.dikontrol = true; ch.g.position.set(x, 0, z); ch.g.rotation.y = ry; };
if (kamu) { pasang(kamu, TITIK_W.x, TITIK_W.z, 0.35); kamu._s = kamu.g.scale.x; kamu._lbl = kamu.g.children.find(o => o.isSprite); kamu._ls = kamu._lbl && kamu._lbl.scale.clone(); }
[[-7.3, 0.4, 0.6], [-2.9, 0.1, -0.4], [-8.1, 3.1, 0.9], [-1.9, 2.6, -0.7]].forEach(([x, z, r], k) => tetangga[k] && pasang(tetangga[k], x, z, r));

// label bangunan (bukan label warga) disembunyikan bila terlalu dekat kamera
const labelBangunan = [];
const kumpulLabel = () => { labelBangunan.length = 0; scene.traverse(o => { if (o.isSprite && o.material.blending !== THREE.AdditiveBlending && !world.karakter().some(ch => ch.g === o.parent)) labelBangunan.push(o); }); };
kumpulLabel();

// ---------- proyek perumahan (video): rumah tumbuh per baris, ganti model lama → baru, mobil gratis muncul
let grupRumah = [], grupMobil = [], modelKini = kota.modelRumah === 'lama' ? 'lama' : 'baru';
function kumpulRumah() { grupRumah = []; grupMobil = []; scene.traverse(o => { if (o.userData.barisKawasan != null) grupRumah.push(o); if (o.userData.mobilKawasan != null) grupMobil.push(o); }); }
kumpulRumah();
function aturRumah(t, i) {
  const s = SEG[i], u = (t - mulai(i)) / (selesai(i) - mulai(i));
  const mdl = s.modelRumah || NASKAH.modelRumah || 'baru';
  if (mdl !== modelKini) { modelKini = mdl; kota.modelRumah = mdl === 'lama' ? 'lama' : ''; world.setKota(kota); kumpulLabel(); kumpulRumah(); penghuniKini = ''; }
  if (NASKAH.bangunRumah) {      // naskah baris "naik": [[baris 0–4, mulai 0–1, selesai 0–1], ...]
    for (const g of grupRumah) {
      const b = g.userData.barisKawasan; let p = 0;
      for (let k = 0; k <= i; k++) for (const [bb, a, z] of SEG[k].naik || []) if (bb === b || bb === 'semua') p = k < i ? 1 : Math.max(p, ease((u - a) / Math.max(0.01, z - a)));
      g.scale.y = Math.max(0.001, p); g.visible = p > 0.003;
      if (!NASKAH.mobilNanti) for (const m of grupMobil) if (m.userData.mobilKawasan === b) { m.scale.y = g.scale.y; m.visible = g.visible; }   // kendaraan ikut rumahnya
    }
  }
  if (NASKAH.mobilNanti) {       // naskah baris "mobil": [mulai, selesai] → mobil muncul (baris demi baris)
    let pm = 0;
    for (let k = 0; k <= i; k++) { const m = SEG[k].mobil; if (m) pm = k < i ? 1 : Math.min(1, Math.max(0, (u - m[0]) / Math.max(0.01, (m[1] ?? m[0] + 0.3) - m[0]))); }
    for (const g of grupMobil) { const q = Math.min(1, Math.max(0, pm * 1.5 - g.userData.mobilKawasan * 0.12)); g.scale.y = Math.max(0.001, q < 1 ? easeOut(q) * (1 + Math.sin(q * Math.PI) * 0.25) : 1); g.visible = q > 0.003; }
  }
}
// kerumunan tukang (ratusan, ringan): naskah "kerumunan": {n, area: [x0, z0, x1, z1]}; baris "kerumunan": true untuk menampilkan
const KER = (() => {
  const K = NASKAH.kerumunan; if (!K) return null;
  const n = K.n || 300, r = rng(11), [x0, z0, x1, z1] = K.area, g = new THREE.Group(); scene.add(g);
  const bagian = [
    [new THREE.BoxGeometry(0.4, 0.6, 0.25).translate(0, 0.86, 0), '#3a5a8c'],     // baju kerja
    [new THREE.BoxGeometry(0.46, 0.5, 0.29).translate(0, 0.9, 0), '#ff7a00'],     // rompi oranye
    [new THREE.BoxGeometry(0.47, 0.05, 0.3).translate(0, 0.8, 0), '#e8eef2'],     // garis reflektif bawah
    [new THREE.BoxGeometry(0.47, 0.05, 0.3).translate(0, 1.0, 0), '#e8eef2'],     // garis reflektif atas
    [new THREE.BoxGeometry(0.38, 0.56, 0.24).translate(0, 0.28, 0), '#3d405b'],   // celana
    [new THREE.SphereGeometry(0.2, 10, 8).translate(0, 1.36, 0), '#c98d5a'],      // kepala
    [new THREE.SphereGeometry(0.235, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.42, 0), '#ffd000'],   // helm proyek
    [new THREE.CylinderGeometry(0.29, 0.29, 0.03, 14).translate(0, 1.43, 0.03), '#ffd000'],                      // pinggiran helm
    [new THREE.BoxGeometry(0.1, 0.5, 0.1).translate(0, -0.22, 0), '#3a5a8c'],     // lengan palu (diputar)
  ];
  const ims = bagian.map(([geo, c]) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }), n); m.castShadow = true; g.add(m); return m; });
  const orang = [];
  for (let k = 0; k < n; k++) orang.push({ x: x0 + r() * (x1 - x0), z: z0 + r() * (z1 - z0), ry: r() * 6.28, f: r() * 6.28, v: 5 + r() * 4, s: 0.85 + r() * 0.3 });
  const o = new THREE.Object3D(), lg = new THREE.Object3D();
  return { g, update(t) {
    orang.forEach((p, k) => {
      const ayun = Math.sin(t * p.v + p.f);
      o.position.set(p.x, Math.max(0, ayun) * 0.06, p.z); o.rotation.set(0, p.ry, Math.sin(t * 1.3 + p.f) * 0.05); o.scale.setScalar(p.s); o.updateMatrix();
      for (let j = 0; j < ims.length - 1; j++) ims[j].setMatrixAt(k, o.matrix);
      lg.position.set(0.28, 1.15, 0.05); lg.rotation.set(-1.0 - Math.max(0, ayun) * 1.2, 0, 0); lg.updateMatrix();
      ims[ims.length - 1].setMatrixAt(k, o.matrix.clone().multiply(lg.matrix));
    });
    ims.forEach(m => { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); });
  } };
})();
// tukang dekat kamera (detail): naskah "tukangDekat": [[x, z, ry], ...]
const TUKANG_DEKAT = (NASKAH.tukangDekat || []).map(([x, z, ry], k) => {
  const c = makeCharUmum({ kulit: ['#c98d5a', '#a8714a', '#e0b08a'][k % 3], baju: ['#3a5a8c', '#5b6770', '#2f4f4f'][k % 3], celana: '#3d405b', rambut: '#1a1a1a' }, { helm: '#ffd000', rompi: ['#ff7a00', '#c6ff00', '#ff7a00'][k % 3] });
  c.scale.setScalar(0.62); c.position.set(x, 0, z); c.rotation.y = ry || 0; scene.add(c); return c;
});
// warga tidur di jalan / rumput (naskah "gelandangan": {n, area}; baris "gelandangan": true)
const GEL = (() => {
  const K = NASKAH.gelandangan; if (!K) return null;
  const n = K.n || 400, r = rng(23), [x0, z0, x1, z1] = K.area, g = new THREE.Group(); scene.add(g);
  const part = [
    [new THREE.BoxGeometry(0.5, 0.26, 1.15).translate(0, 0.13, 0.05), null],       // sarung / selimut (warna per orang)
    [new THREE.SphereGeometry(0.2, 10, 8).translate(0, 0.2, -0.68), '#c98d5a'],     // kepala
    [new THREE.BoxGeometry(0.42, 0.08, 0.3).translate(0, 0.04, -0.72), '#e9e2d0'],  // bantal kardus
  ];
  const SARUNG = ['#2a6f97', '#8d5a97', '#b5523b', '#3d6b3f', '#c9a227', '#5b4636', '#7f8c8d'];
  const ims = part.map(([geo, c]) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: c || '#ffffff', roughness: 0.9 }), n); m.castShadow = true; g.add(m); return m; });
  const o = new THREE.Object3D(), cl = new THREE.Color(), daftar = [];
  for (let k = 0; k < n; k++) {
    o.position.set(x0 + r() * (x1 - x0), 0, z0 + r() * (z1 - z0)); o.rotation.set(0, r() * 6.28, 0); o.scale.setScalar(0.9 + r() * 0.25); o.updateMatrix();
    ims.forEach(m => m.setMatrixAt(k, o.matrix)); ims[0].setColorAt(k, cl.set(SARUNG[Math.floor(r() * SARUNG.length)]));
    daftar.push(o.matrix.clone());
  }
  ims.forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); });
  return { g, ims, daftar };
})();
// monumen raksasa berisi nama warga (naskah "monumen": {x, z, nama: [...]}; baris "monumen": true)
const MON = (() => {
  const K = NASKAH.monumen; if (!K) return null;
  const g = new THREE.Group(); g.position.set(K.x, 0, K.z); scene.add(g);
  const emas = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.6, roughness: 0.35, emissive: '#5a4300', emissiveIntensity: 0.25 });
  const batu = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.7 });
  const kotak = (w, h, d, y, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.y = y + h / 2; b.castShadow = true; g.add(b); return b; };
  kotak(16, 0.6, 16, 0, batu); kotak(12.5, 0.6, 12.5, 0.6, batu); kotak(9, 0.6, 9, 1.2, batu);
  kotak(5.2, 12, 5.2, 1.8, batu); kotak(4.2, 8, 4.2, 13.8, batu); kotak(3, 5, 3, 21.8, batu);
  const puncak = new THREE.Mesh(new THREE.ConeGeometry(2.1, 5, 4), emas); puncak.position.y = 29.3; puncak.rotation.y = Math.PI / 4; g.add(puncak);
  const bintang = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), emas); bintang.position.y = 32.6; g.add(bintang);
  // prasasti nama warga di 4 sisi
  const nama = K.nama || [];
  for (let sisi = 0; sisi < 4; sisi++) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 1180; const c2 = cv.getContext('2d');
    c2.fillStyle = '#20304a'; c2.fillRect(0, 0, 512, 1180); c2.strokeStyle = '#d4af37'; c2.lineWidth = 14; c2.strokeRect(10, 10, 492, 1160);
    c2.fillStyle = '#ffd166'; c2.font = '900 38px sans-serif'; c2.textAlign = 'center'; c2.fillText('WARGA SIDOARJOVERSE', 256, 70);
    c2.font = '700 25px sans-serif'; c2.fillStyle = '#f4ecd8';
    for (let k = 0; k < 66; k++) { const nm = nama[(k * 4 + sisi) % Math.max(1, nama.length)] || ''; c2.fillText(nm, 128 + (k % 2) * 256, 120 + Math.floor(k / 2) * 32); }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 10.6), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: 0.25 }));
    const a = sisi * Math.PI / 2; pl.position.set(Math.sin(a) * 2.62, 7.8, Math.cos(a) * 2.62); pl.rotation.y = a; g.add(pl);
  }
  g.visible = false; return g;
})();
function aturKerumunan(t, s) {
  if (GEL) GEL.g.visible = !!s.gelandangan;
  if (MON) { MON.visible = !!s.monumen; if (s.monumen) { const u = Math.min(1, (t - mulai(segPada(t))) / 1.2); MON.scale.y = s.monumenNaik ? Math.max(0.01, easeOut(u)) : 1; MON.children.at(-6) && 0; } }
  if (KER) { KER.g.visible = !!s.kerumunan; if (s.kerumunan) KER.update(t); }
  TUKANG_DEKAT.forEach((c, k) => { c.visible = !!s.kerumunan; const a = c.userData.anim; a.arms[1].rotation.x = -1.2 + Math.abs(Math.sin(t * 7 + k)) * -1.1; a.arms[0].rotation.x = -0.4; });
}
// jalan tanah → aspal di tengah kalimat (naskah baris "aspal": fraksi)
const jalanAwal = !!kota.jalan;
function aturJalan(t) {
  let on = jalanAwal;
  SEG.forEach((sg, k) => { if (sg.aspal != null && t >= sg.start + sg.dur * sg.aspal) on = true; });
  if (on !== !!kota.jalan) { kota.jalan = on; world.setKota(kota); kumpulLabel(); }
}
// warga online (naskah "tamu": [{kode, nama, gender, kecamatan, pekerjaan, baris, tunda, dari:[x,z], ke:[x,z]}]) + gelembung chat (baris "chat": [[tunda, kode, teks]])
const TAMU = (NASKAH.tamu || []).map(d => Object.assign({ w: { kode: d.kode, nama: d.nama, gender: d.gender || 'L', kecamatan: d.kecamatan || 'Sidoarjo', pekerjaan: d.pekerjaan || 'Warga' } }, d));
const chatTerkirim = new Set();
// hantu sarung putih (naskah "hantu": {x, z}; baris "hantu": {dari: fraksi, ke: [x, z] (opsional), skala, kedip})
const hantu = new THREE.Group(); hantu.visible = false; scene.add(hantu);
{
  const putih = new THREE.MeshStandardMaterial({ color: '#f4f6f8', emissive: '#c9d6e3', emissiveIntensity: 0.55, roughness: 0.9, transparent: true, opacity: 0.93 });
  const badan = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.78, 1.7, 18, 1, true), putih); badan.position.y = 1.05; hantu.add(badan);
  const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.47, 20, 16), putih); kepala.position.y = 1.95; hantu.add(kepala);
  for (let k = 0; k < 6; k++) { const ek = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 8), putih); const a = k / 6 * Math.PI * 2; ek.position.set(Math.cos(a) * 0.68, 0.12, Math.sin(a) * 0.68); ek.rotation.x = Math.PI; hantu.add(ek); }
  const hitam = new THREE.MeshBasicMaterial({ color: '#16181d' });
  for (const x of [-0.16, 0.16]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), hitam); m.position.set(x, 2.02, 0.43); m.scale.set(1, 1.5, 0.5); hantu.add(m); }
  const sinar = new THREE.PointLight('#cfe3ff', 3, 7, 1.6); sinar.position.set(0, 1.6, 0.6); hantu.add(sinar);
}
const HANTU0 = NASKAH.hantu || { x: -17.7, z: 13.6 };
// cahaya senter misterius (naskah baris "cahaya": {dari: [x, z], ke: [x, z], mulai: 0–1, lama: 0–1})
const cahaya = new THREE.Group(); cahaya.visible = false; scene.add(cahaya);
{ const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff6c8' })); cahaya.add(b);
  const l = new THREE.PointLight('#ffe9a8', 60, 18, 1.4); cahaya.add(l);
  const g = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1b0', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })); cahaya.add(g); }
function aturCahaya(t, s) {
  const h = s.cahaya; cahaya.visible = !!h; if (!h) return;
  const u = (t - s.start) / s.dur, m = h.mulai ?? 0, k = Math.min(1, Math.max(0, (u - m) / (h.lama ?? (1 - m))));
  cahaya.position.set(h.dari[0] + (h.ke[0] - h.dari[0]) * k, (h.y ?? 1.9) + Math.sin(t * 7) * 0.08, h.dari[1] + (h.ke[1] - h.dari[1]) * k);
  cahaya.children[1].intensity = 60 * (0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.3));
}
function aturHantu(t, s) {
  const h = s.hantu; if (!h) { hantu.visible = false; return; }
  const u = (t - s.start) / s.dur; if (u < (h.dari || 0)) { hantu.visible = false; return; }
  const k = ease(Math.min(1, (u - (h.dari || 0)) / Math.max(0.05, (h.lama || 0.6)))), ke = h.ke || [HANTU0.x, HANTU0.z];
  hantu.visible = !h.kedip || Math.sin(t * 37) + Math.sin(t * 23) > -0.6;
  hantu.position.set(HANTU0.x + (ke[0] - HANTU0.x) * k, 0.35 + Math.sin(t * 2.6) * 0.18, HANTU0.z + (ke[1] - HANTU0.z) * k);
  hantu.scale.setScalar(h.skala || 1); hantu.rotation.y = Math.atan2(camera.position.x - hantu.position.x, camera.position.z - hantu.position.z) + Math.sin(t * 1.7) * 0.15;
}
// penghuni rumah (naskah baris "isi": [[tunda, idRumah, {nama, kode, gender}]] → papan nama di depan rumah, kumulatif)
let penghuniKini = '';
function aturPenghuni(t) {
  const map = {};
  SEG.forEach(sg => (sg.isi || []).forEach(([tunda, id, p]) => { if (t >= sg.start + tunda) map[id] = Object.assign({ gender: 'L', kecamatan: 'Sidoarjo', pekerjaan: 'Warga' }, p); }));
  const kunci = JSON.stringify(map);
  if (kunci !== penghuniKini) {
    penghuniKini = kunci; world.setPenghuni(map, NASKAH.kodeSaya || '');
    // papan nama rumah dibuat untuk layar HP; di video dikecilkan supaya tidak saling tumpuk
    scene.traverse(o => { const sp = o.userData && o.userData.papanRumah; if (sp && !sp.userData.kecil) { sp.scale.multiplyScalar(NASKAH.skalaPapan || 0.72); sp.userData.kecil = true; } });
    kumpulLabel();
  }
  return Object.keys(map).length;
}
// bagian dalam rumah (naskah "dalam": {rumah: id, p: {...}}; kamera "dalam")
let DALAM = null;
if (NASKAH.dalam) {
  const rmh = kota.bangunan.find(b => b.id === NASKAH.dalam.rumah) || { id: 'rumah', nama: 'Rumah' };
  DALAM = adeganRumah(rmh, NASKAH.dalam.p || null);
  DALAM.cam = new THREE.PerspectiveCamera(58, W / H, 0.1, 60);
  if (DALAM.ch) { DALAM.ch.position.set(1.0, 0, 1.7); DALAM.ch.rotation.y = -0.3; }
}
function aturTamu(t) {
  for (const d of TAMU) {
    const sg = SEG[d.baris]; if (!sg) continue;
    const t0 = mulai(d.baris) + (d.tunda || 0); if (t < t0) continue;
    const u = Math.min(1, (t - t0) / (d.lama || 2.6)), e = ease(u);
    const x = d.dari[0] + (d.ke[0] - d.dari[0]) * e, z = d.dari[1] + (d.ke[1] - d.dari[1]) * e;
    const ry = u < 1 ? Math.atan2(d.ke[0] - d.dari[0], d.ke[1] - d.dari[1]) : (d.ry ?? 0.4);
    world.tamu(d.kode, { w: d.w, x, z, ry, j: u < 1 });
    if (!d._kecil) {   // label 🟢 dibuat untuk layar HP; di video dikecilkan supaya seukuran label warga lain
      const ch = world.karakter().find(c => c.g.userData.pick && c.g.userData.pick.data && c.g.userData.pick.data.kode === d.kode);
      const lb = ch && ch.g.children.find(o => o.isSprite);
      if (lb) { lb.scale.multiplyScalar(d.skalaLabel || 0.5); d._kecil = true; }
    }
  }
  SEG.forEach((sg, k) => (sg.chat || []).forEach(([tunda, kode, teks], j) => {
    const id = k + ':' + j; if (!chatTerkirim.has(id) && t >= sg.start + tunda) { chatTerkirim.add(id); world.gelembung(kode, teks); }
  }));
}
const _wp = new THREE.Vector3();
// ------------------------------------------------------------ util
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const popS = (t, t0, d = 0.28) => { const x = (t - t0) / d; if (x <= 0) return 0; if (x >= 1) return 1; const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------ kamera: setiap jenis = titik awal → akhir
const LIHAT_D = V(0, 1.95, 0.6);   // tinggi wajah Cak Darjo (gaya figur premium)
function bidikan(jenis, sebelum) {
  const sb = sebelum || { pos: V(0, 2.1, 4.6), look: LIHAT_D.clone() };
  const [j, arg] = String(jenis || 'closeup').split(':');
  switch (j) {
    case 'medium': return { a: { pos: V(0.4, 1.95, 6.6), look: V(0, 1.6, 0.6) }, b: { pos: V(0.9, 1.95, 6.1), look: V(0, 1.6, 0.6) }, e: ease };
    case 'mundur': return { a: sb, b: { pos: V(9, 13, 21), look: V(0, 0.4, -5) }, e: easeOut };
    case 'udara': return { a: { pos: V(9, 13, 21), look: V(0, 0.4, -5) }, b: { pos: V(-5, 15, 21), look: V(-2, 0, -7) }, e: ease };
    case 'atas': return { a: { pos: V(lahanB.x + 4, 9, lahanB.z + 12), look: V(lahanB.x + 2, 0, lahanB.z + 3) }, b: { pos: V(+lahanB.x, 25, lahanB.z + 11), look: V(+lahanB.x, 0, +lahanB.z) }, e: easeOut };
    case 'papan': return { a: { pos: V(0.3, 2.35, 7.9), look: V(0, 2.05, 0.6) }, b: { pos: V(0.6, 2.35, 7.3), look: V(0, 2.05, 0.6) }, e: ease };
    case 'warga': return { a: { pos: V(-2.6, 3.1, 9.6), look: V(-5, 1.25, 2) }, b: { pos: V(-3.4, 2.7, 8.4), look: V(-5, 1.3, 2) }, e: ease };
    case 'cctv': {     // kamera pengawas di pojok: cctv:<id rumah>
      const b = kota.bangunan.find(x => x.id === arg) || { x: -17.7, z: 11.2 }, bx = +b.x, bz = +b.z;
      return { a: { pos: V(bx - 5.5, 8.5, bz + 9.5), look: V(bx - 0.2, 0.6, bz + 4.6) }, b: { pos: V(bx - 5.5, 8.5, bz + 9.5), look: V(bx, 0.6, bz + 4.8) }, e: ease, cctv: true };
    }
    case 'sinema': {   // shot sinematik kota: sinema:drone | sinema:jalan | sinema:putar:<id> | sinema:pintu:<id>
      const [, jenisS, id] = String(jenis).split(':');
      const b = kota.bangunan.find(x => x.id === id) || { x: 0, z: 0 }, bx = +b.x, bz = +b.z;
      if (jenisS === 'drone') return { a: { pos: V(42, 34, 44), look: V(0, 0, 2) }, b: { pos: V(-18, 27, 46), look: V(-10, 0, 4) }, e: ease };
      if (jenisS === 'jalan') return { a: { pos: V(6, 1.7, 22), look: V(-8, 1.4, 12) }, b: { pos: V(-4, 1.7, 18.5), look: V(bx || -17.7, 1.6, bz || 11.2) }, e: ease };
      if (jenisS === 'putar') { const R = 15, h = 6, a0 = 0.15, a1 = 1.05;
        return { a: { pos: V(bx + Math.sin(a0) * R, h, bz + Math.cos(a0) * R), look: V(bx, 1.4, bz) }, b: { pos: V(bx + Math.sin(a1) * R, h - 1.5, bz + Math.cos(a1) * R), look: V(bx, 1.4, bz) }, e: ease, putar: { bx, bz, R, h, a0, a1 } }; }
      if (jenisS === 'pintu') return { a: { pos: V(bx + 3.5, 2.6, bz + 14), look: V(bx, 1.5, bz + 1) }, b: { pos: V(bx + 0.8, 1.9, bz + 7.2), look: V(bx, 1.5, bz + 1) }, e: ease };
      return { a: { pos: V(30, 25, 35), look: V(0, 0, 0) }, b: { pos: V(20, 20, 30), look: V(0, 0, 0) }, e: ease };
    }
    case 'rumah': {   // review deretan rumah satu blok (mis. rumah:blokA)
      const bl = (arg || 'blokA').replace(/^blok/i, ''), rs = kota.bangunan.filter(b => b.blok === bl);
      const cx = rs.length ? rs.reduce((a, b) => a + +b.x, 0) / rs.length : -22, cz = rs.length ? rs.reduce((a, b) => a + +b.z, 0) / rs.length : 8;
      return { a: { pos: V(cx - 5, 21, cz + 35), look: V(cx - 0.5, 1.5, cz) }, b: { pos: V(cx + 5, 19, cz + 33), look: V(cx - 0.5, 1.5, cz) }, e: ease };
    }
    case 'dalam': return { a: { pos: V(0.5, 3.1, 12.5), look: V(-0.3, 1.3, -0.6) }, b: { pos: V(0, 2.7, 10.2), look: V(-0.3, 1.25, -0.6) }, e: easeOut, dalam: true };
    case 'ramai': return { a: { pos: V(3.0, 5.2, 17.0), look: V(0, 0.9, 3.4) }, b: { pos: V(1.9, 4.7, 15.4), look: V(0, 0.9, 3.4) }, e: ease };   // warga online di alun-alun
    case 'ayam': return { a: { pos: V(2.6, 1.3, 5.2), look: V(0.9, 0.7, 1.3) }, b: { pos: V(2.2, 1.05, 4.4), look: V(0.9, 0.7, 1.3) }, e: ease };
    case 'bangunan': {
      const b = kota.bangunan.find(x => x.id === arg) || lahanB;
      return { a: { pos: V(+b.x - 4, 15, +b.z + 24), look: V(+b.x, 0.8, +b.z) }, b: { pos: V(+b.x - 2, 12, +b.z + 19), look: V(+b.x, 1.0, +b.z) }, e: ease };
    }
    default: return { a: { pos: V(0, 2.2, 5.6), look: LIHAT_D.clone() }, b: { pos: V(0, 2.18, 4.9), look: LIHAT_D.clone() }, e: ease }; // closeup
  }
}
// kamera bebas dari naskah: "kam": [[posA], [lihatA], [posB], [lihatB]] atau {"putar": [x, z, R, tinggi, sudut0, sudut1], "lihat": [x, y, z]}
function kamBebas(k) {
  if (Array.isArray(k)) return { a: { pos: V(...k[0]), look: V(...k[1]) }, b: { pos: V(...k[2]), look: V(...k[3]) }, e: ease };
  const [bx, bz, R, h, a0, a1] = k.putar, L = V(...(k.lihat || [bx, 1.4, bz]));
  return { a: { pos: V(bx, h, bz + R), look: L }, b: { pos: V(bx, h, bz + R), look: L.clone() }, e: ease, putar: { bx, bz, R, h, a0, a1 } };
}
const SHOT = []; { let prev = null; for (const s of SEG) { const b = s.jalur ? { jalur: buatJalur(s.jalur), a: { pos: V(0, 2, 0), look: V(0, 2, 1) }, b: { pos: V(0, 2, 0), look: V(0, 2, 1) }, e: ease } : s.kam ? Object.assign(kamBebas(s.kam), { cctv: /^cctv/.test(String(s.kamera)) }) : bidikan(s.kamera, prev); SHOT.push(b); prev = b.b; } }
// ---- kamera jalan kaki orang pertama (found footage): "jalur": [[x,z],...], "tinggi", "lihat": [x,y,z], "lihatDari": fraksi, "toleh": [[fraksi, derajat]...], "jalanSampai": fraksi, "goyang", "fov"
function buatJalur(pts) { const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])); return { pts, cum, total: cum[cum.length - 1] || 0.001 }; }
function titikJalur(J, d) {
  const { pts, cum } = J; d = Math.max(0, d);
  for (let k = 1; k < pts.length; k++) if (d <= cum[k] || k === pts.length - 1) { const u = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1); return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u]; }
  return pts[0];
}
let fovSkr = 40;
function aturFov(f) { if (Math.abs(f - fovSkr) > 0.01) { fovSkr = f; camera.fov = f; camera.updateProjectionMatrix(); } }
function kameraJalur(t, i, sh) {
  const s = SEG[i], J = sh.jalur, T0 = mulai(i), T1 = selesai(i), fr = (t - T0) / Math.max(0.01, T1 - T0);
  aturFov(s.fov ?? 62);
  const u = Math.min(1, fr / (s.jalanSampai ?? 1)), d = J.total * (s.halus === false ? u : ease(u)), [px, pz] = titikJalur(J, d);
  let [fx, fz] = titikJalur(J, d + 5); if (Math.hypot(fx - px, fz - pz) < 1) { const n = J.pts.length, a = J.pts[n - 2] || J.pts[0], b = J.pts[n - 1]; fx = px + (b[0] - a[0]); fz = pz + (b[1] - a[1]); }
  const g = s.goyang ?? 1, gerak = u < 1;
  const y = (s.tinggi ?? 1.65) + (gerak ? Math.abs(Math.sin(d * 1.7)) * 0.07 * g : 0) + Math.sin(t * 1.3) * 0.012 * g;
  const ayun = gerak ? Math.sin(d * 0.85) * 0.05 * g : 0;
  camera.position.set(px + ayun, y, pz);
  const L = new THREE.Vector3(fx, y - 0.1, fz);
  if (s.lihat) { const k = ease((fr - (s.lihatDari ?? 0)) / 0.18); L.lerp(V(...s.lihat), k); }
  if (s.toleh) { const kf = s.toleh; let deg = kf[0][1]; for (let k = 1; k < kf.length; k++) if (fr >= kf[k - 1][0]) deg = kf[k - 1][1] + (kf[k][1] - kf[k - 1][1]) * ease((fr - kf[k - 1][0]) / ((kf[k][0] - kf[k - 1][0]) || 1));
    const a = deg * Math.PI / 180, dx = L.x - px, dz = L.z - pz; L.x = px + dx * Math.cos(a) + dz * Math.sin(a); L.z = pz - dx * Math.sin(a) + dz * Math.cos(a); }
  L.x += (Math.sin(t * 2.3) * 0.05 + Math.sin(t * 5.7) * 0.02) * g; L.y += (Math.sin(t * 3.1) * 0.04 + Math.sin(t * 7.3) * 0.015) * g;
  camera.lookAt(L); camera.rotateZ(Math.sin(t * 1.1) * 0.015 * g);
  if (NASKAH.kabutIkut) world.ikutKamera(px, pz);
}
function kamera(t) {
  const i = segPada(t), sh = SHOT[i];
  if (sh.jalur) { kameraJalur(t, i, sh); return; }
  aturFov(SEG[i].fov ?? 40);
  const d = Math.max(0.3, Math.min(selesai(i) - mulai(i), sh.e === easeOut ? 1.6 : 99));
  const k = sh.e((t - mulai(i)) / d);
  const cam = sh.dalam && DALAM ? DALAM.cam : camera;
  cam.position.copy(sh.a.pos).lerp(sh.b.pos, k);
  if (sh.putar) { const o = sh.putar, a = o.a0 + (o.a1 - o.a0) * k; cam.position.set(o.bx + Math.sin(a) * o.R, o.h - 1.5 * k, o.bz + Math.cos(a) * o.R); }
  const L = sh.a.look.clone().lerp(sh.b.look, k);
  if (NASKAH.handycam) { L.x += Math.sin(t * 2.3) * 0.03 + Math.sin(t * 5.7) * 0.012; L.y += Math.sin(t * 3.1) * 0.025; }
  cam.lookAt(L); if (NASKAH.handycam) cam.rotateZ(Math.sin(t * 1.1) * 0.012);
  if (NASKAH.kabutIkut && !sh.dalam) world.ikutKamera(L.x, L.z);
}

// ------------------------------------------------------------ Cak Darjo
function animDarjo(t, f) {
  const amp = TL.amp[Math.min(f, TL.amp.length - 1)] || 0;
  const i = segPada(t), s = SEG[i];
  const bicara = t >= s.start && t <= s.start + s.dur;
  // ekspresi dasar per baris (naskah: "ekspresi"), mulut ikut suara saat bicara
  darjo.userData.ekspresi(s.ekspresi || (s.pose === 'senyum' ? 'senang' : 'normal'));
  if (bicara && amp > 0.1) darjo.userData.ekspresi(amp > 0.28 ? 'buka' : 'diam');
  const head = darjo.userData.anim.head;
  head.rotation.z = Math.sin(t * 2.1) * 0.04 + (bicara ? Math.sin(t * 7) * amp * 0.05 : 0);
  head.rotation.x = bicara ? -amp * 0.06 : 0;
  head.rotation.y = s.pose === 'menoleh' ? Math.sin((t - mulai(i)) * 2.4) * 0.55 : 0;
  darjo.position.y = Math.abs(Math.sin(t * 2.2)) * 0.02;
  const lambai = s.pose === 'melambai' && t >= mulai(i) && t < s.start + Math.min(2.2, s.dur);
  if (lambai) tangan.rotation.set(0, 0, 2.4 + Math.sin(t * 14) * 0.35); else tangan.rotation.copy(tanganAwal);
  const pakaiAkua = s.prop === 'akuarium';
  akua.group.visible = pakaiAkua; if (tongkat) tongkat.visible = !pakaiAkua;
  if (pakaiAkua) {     // dua tangan memegang akuarium; bandeng & udang "gelut"
    tangan.rotation.set(-0.8, 0, -0.42); if (tanganKiri) tanganKiri.rotation.set(-0.8, 0, 0.42);
    akua.tick(t * 4.5);
  } else if (s.pose === 'hp' || s.pose === 'geleng') {   // tangan kiri memegang HP, kepala menunduk (geleng: sambil geleng-geleng)
    if (tanganKiri) tanganKiri.rotation.set(-1.25, 0, 0.55);
    head.rotation.x = 0.22 + (bicara ? -amp * 0.06 : 0);
    if (s.pose === 'geleng') head.rotation.y = Math.sin(t * 9) * 0.32;
  } else if (s.pose === 'gunting') {   // dua tangan ke depan memegang gunting pita
    tangan.rotation.set(-1.25, 0, -0.25); if (tanganKiri) tanganKiri.rotation.set(-1.1, 0, 0.35);
  } else if (s.pose === 'angkat-papan') {   // dua tangan ke atas memegang papan
    tangan.rotation.set(0, 0, 2.75); if (tanganKiri) tanganKiri.rotation.set(0, 0, -2.75);
  } else if (tanganKiri) tanganKiri.rotation.copy(kiriAwal);
  papanAngkat.visible = s.pose === 'angkat-papan'; gunting.visible = s.pose === 'gunting';
  hp.visible = s.pose === 'hp' || s.pose === 'geleng';
  if (tongkat) tongkat.visible = !pakaiAkua && !papanAngkat.visible;
  if (papanAngkat.visible) papanAngkat.position.y = Math.sin(t * 3) * 0.03;
  if (tukang) { const a = tukang.userData.anim; a.arms[1].rotation.x = -1.2 + Math.abs(Math.sin(t * 7)) * -1.1; a.arms[0].rotation.x = -0.4; }
  ayam.rotation.x = Math.max(0, Math.sin(t * 6)) * 0.35;
}

// ------------------------------------------------------------ overlay 2D
const out = document.getElementById('out');
out.width = W * SKALA; out.height = H * SKALA;
const c = out.getContext('2d');
const FONT = '"DejaVu Sans", system-ui, sans-serif', EMO = '"Noto Color Emoji"';
const TEAL = '#0f4c5c', OREN = '#f28c28', KUNING = '#ffd166', KREM = '#fff8ec';
const WARNA = { kuning: [KUNING, '#3b2a00', '#b8861f'], oren: [OREN, '#fff', '#b8611a'], putih: ['#fff', '#16324f', '#c9c2b4'], teal: [TEAL, '#fff', '#082d36'], merah: ['#e63946', '#fff', '#9b1d27'] };

function rr(x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function teks(str, x, y, { size = 40, warna = '#fff', bobot = 800, align = 'center', garis = 0, warnaGaris = TEAL } = {}) {
  c.font = `${bobot} ${size}px ${FONT}, ${EMO}`; c.textAlign = align; c.textBaseline = 'middle';
  if (garis) { c.lineJoin = 'round'; c.lineWidth = garis; c.strokeStyle = warnaGaris; c.strokeText(str, x, y); }
  c.fillStyle = warna; c.fillText(str, x, y);
}
function ukur(str, size, bobot = 800) { c.font = `${bobot} ${size}px ${FONT}, ${EMO}`; return c.measureText(str).width; }
function pas(str, size, maks, bobot) { while (ukur(str, size, bobot) > maks && size > 18) size -= 2; return size; }
function denganSkala(cx, cy, s, fn) { if (s <= 0.001) return; c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); fn(); c.restore(); }
function pil(str, cx, cy, s, warna = 'kuning', size = 40, pad = 26) {
  const [bg, fg, bayang] = WARNA[warna] || WARNA.kuning;
  size = pas(str, size, W - 80 - pad * 2);
  denganSkala(cx, cy, s, () => {
    const w = ukur(str, size) + pad * 2, h = size + 30;
    c.fillStyle = bayang; rr(cx - w / 2, cy - h / 2 + 6, w, h, h / 2); c.fill();
    c.fillStyle = bg; rr(cx - w / 2, cy - h / 2, w, h, h / 2); c.fill();
    teks(str, cx, cy + 1, { size, warna: fg });
  });
}
function kartu(cx, cy, w, h, s, isi, { bg = '#ffffff', tepi = TEAL } = {}) {
  denganSkala(cx, cy, s, () => {
    c.fillStyle = 'rgba(0,0,0,.18)'; rr(cx - w / 2, cy - h / 2 + 8, w, h, 26); c.fill();
    c.fillStyle = bg; rr(cx - w / 2, cy - h / 2, w, h, 26); c.fill();
    c.lineWidth = 5; c.strokeStyle = tepi; c.stroke();
    isi(cx - w / 2, cy - h / 2);
  });
}
function proyeksi(p) { const v = p.clone().project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }

// subtitle per 3–5 kata. Waktunya hanya berjalan saat suara terdengar (jeda dilewati), sesuai panjang huruf.
function bagianBersuara(sg) {
  const f0 = Math.floor(sg.start * FPS), f1 = Math.ceil((sg.start + sg.dur) * FPS);
  const iv = []; let a = null, diam = 0;
  for (let f = f0; f <= f1; f++) {
    const on = (TL.amp[f] || 0) > 0.06;
    if (on) { if (a === null) a = f; diam = 0; }
    else if (a !== null && ++diam > 6) { iv.push([a / FPS, (f - diam + 1) / FPS]); a = null; diam = 0; }
  }
  if (a !== null) iv.push([a / FPS, f1 / FPS]);
  return iv.length ? iv : [[sg.start, sg.start + sg.dur]];
}
const potongan = SEG.map(sg => {
  if (sg.potong) return sg.potong.map(([t0, t1, x]) => ({ t0, t1, x }));   // dari alat/rekaman.py (waktu kata asli)
  const kata = sg.cap.split(' '); const chunk = []; let cur = [];
  for (const k of kata) {
    if (cur.length && (cur.join(' ') + ' ' + k).length > 22) { chunk.push(cur.join(' ')); cur = []; }
    cur.push(k);
    if (/[.!?]$/.test(k) || (/[…,:—]$/.test(k) && cur.join(' ').length >= 8)) { chunk.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) chunk.push(cur.join(' '));
  const iv = bagianBersuara(sg), total = iv.reduce((x, [a, b]) => x + b - a, 0);
  const waktu = frac => { let sisa = frac * total; for (const [a, b] of iv) { if (sisa <= b - a) return a + sisa; sisa -= b - a; } return iv[iv.length - 1][1]; };
  // waktu dibagi menurut suku kata di bagian yang benar-benar bersuara; potongan setelah tanda baca
  // ditempelkan ke awal frasa terdekat (sesudah jeda napas) supaya tidak tertinggal
  const suku = x => Math.max(1, (x.toLowerCase().replace(/ktp/g, 'katepe').match(/[aiueo]+/g) || []).length);
  {
    const tot = chunk.reduce((a, x) => a + suku(x), 0); let acc = 0;
    const r = chunk.map((x, k) => {
      let t0 = waktu(acc / tot); acc += suku(x);
      if (k > 0 && /[.!?,…:]$/.test(chunk[k - 1])) {
        const dekat = iv.map(v => v[0]).filter(a => Math.abs(a - t0) < 0.7).sort((p, q) => Math.abs(p - t0) - Math.abs(q - t0))[0];
        if (dekat != null) t0 = dekat;
      }
      return { t0: t0 - 0.1, x };
    });
    for (let k = 1; k < r.length; k++) r[k].t0 = Math.max(r[k].t0, r[k - 1].t0 + 0.35);
    r.forEach((c, k) => { c.t1 = k < r.length - 1 ? r[k + 1].t0 - 0.12 : iv[iv.length - 1][1]; });
    return r;
  }
  const tot = chunk.reduce((a, x) => a + x.length, 0); let acc = 0;
  return chunk.map(x => { const r = { t0: waktu(acc / tot), t1: waktu((acc + x.length) / tot), x }; acc += x.length; return r; });
}).flat();
function subtitle(t) {
  const p = potongan.findLast(p => t >= p.t0 - 0.05 && t < p.t1 + 0.12);
  if (!p) return;
  const s = popS(t, p.t0 - 0.05, 0.18) * 0.12 + 0.88;
  const pj = SEG[segPada(t)].darjo === 'pojok';
  const size = pas(p.x, 44, pj ? 400 : 600), w = ukur(p.x, size) + 60, h = 86, cx = pj ? 40 + w / 2 : W / 2, cy = pj ? 1150 : 1050;
  denganSkala(cx, cy, s, () => {
    c.fillStyle = 'rgba(15,76,92,.93)'; rr(cx - w / 2, cy - h / 2, w, h, 22); c.fill();
    let x = cx - ukur(p.x, size) / 2;
    for (const k of p.x.split(' ')) {
      const huruf = k.replace(/[^A-Za-z]/g, '');
      const sorot = huruf.length >= 3 && huruf === huruf.toUpperCase();
      teks(k, x, cy + 2, { size, warna: sorot ? KUNING : '#fff', align: 'left' });
      x += ukur(k + ' ', size);
    }
  });
}

// ------------------------------------------------------------ stiker
const KONFETI = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % W, v: 280 + (i * 53) % 260, r: (i * 31) % 360, w: 10 + (i % 4) * 4, col: ['#f28c28', '#ffd166', '#2a9d8f', '#e63946', '#8338ec'][i % 5], d: (i % 7) * 0.05 }));
const POS_IDE = [[150, 330], [560, 290], [175, 470], [565, 440], [360, 220]];
const sfx = [];
const catat = (t, j) => sfx.push([+t.toFixed(3), j]);

// waktu munculnya setiap stiker
SEG.forEach((s, i) => {
  (s.stiker || []).forEach((st, k) => { const td = st.tunda ?? (k === 0 ? 0.15 : 0.45 + k * 0.3); st._s0 = s.start + td; st._t0 = (st.lanjut ? mulai(i) : s.start) + td; });   // lanjut: tampil sejak adegan dimulai (tanpa kedip); stempel tetap ikut suara
  (s.isi || []).forEach(([td]) => catat(s.start + td, 'pop'));
  if (s.kilat != null) catat(s.start + s.dur * s.kilat, 'petir');
  const durAdegan = () => +(selesai(i) - mulai(i)).toFixed(2);
  for (const a of [].concat(s.suasana || [])) catat(mulai(i), `amb:${a}:${durAdegan()}`);
  if (s.jalur && (s.langkah ?? true)) catat(mulai(i), `langkah:${(durAdegan() * (s.jalanSampai ?? 1)).toFixed(2)}`);
  if (s.glitch) catat(mulai(i), 'glitch');
  for (const [td, j] of s.efek || []) catat(mulai(i) + td, j);
  if (s.hantu) catat(s.start + s.dur * (s.hantu.dari || 0), 'seram');
  if (s.sfx === 'krik') catat(s.start + s.dur + 0.1, 'krik');
  else if (s.sfx === 'whoosh') catat(mulai(i) + 0.02, 'whoosh');
  else if (s.sfx === 'stempel') catat(s.start + s.dur * 0.8, 'stempel');
  else if (s.sfx === 'tada') catat(s.start + 0.3, 'tada');
  for (const st of s.stiker || []) {
    if (['pil', 'papan', 'kartu_teks', 'judul', 'url', 'follow', 'aturan', 'klasemen', 'layar'].includes(st.jenis)) catat(st._t0, 'pop');
    if (['headline', 'langkah', 'voting'].includes(st.jenis)) catat(st._t0, 'pop');
    if (st.jenis === 'chip') st.items.forEach((_, k) => { if (!(st.lanjut && k === 0)) catat(st._t0 + (st.lanjut ? k - 1 : k) * 0.45, 'pop'); });
    if (st.jenis === 'tangga') st.items.forEach((_, k) => catat(st._t0 + k * 0.35, 'pop'));
    if (st.jenis === 'ide') st.items.forEach((_, k) => catat(s.start + 0.2 + k * s.dur * 0.18, 'pop'));
    if (st.jenis === 'komen') st.items.forEach((_, k) => catat(st._t0 + 0.3 + k * 0.5, 'pop'));
    if (st.jenis === 'protes') { if (!st.lanjut) catat(st._t0, 'pop'); if (st.stempel != null) catat(st._s0 + st.stempel, 'stempel'); }
    if (st.jenis === 'hitung' && !st.lanjut) catat(st._t0, 'pop');
    if (st.jenis === 'kertas' && !st.lanjut) catat(st._t0, 'pop');
    if (st.jenis === 'petunjuk') st.items.forEach((_, k) => { if (!(st.lanjut && k < (st.sudah || 0))) catat(st._t0 + k * (st.jeda || 0.9), 'pop'); });
    if (st.jenis === 'tumpuk') st.items.forEach((_, k) => catat(st._t0 + k * 0.22 + 0.4, 'pop'));
  }
});

// kartu komentar ala media sosial, pusat (cx, cy)
const WARNA_AV = ['#e76f51', '#2a9d8f', '#8338ec', '#f4a261', '#3a86ff', '#e63946'];
function bungkus(str, size, maks) {
  const out = [[]]; let lw = 0;
  for (const k of str.split(' ')) { const w = ukur(k + ' ', size, 600); if (lw + w > maks && out[out.length - 1].length) { out.push([]); lw = 0; } out[out.length - 1].push(k); lw += w; }
  return out.map(b => b.join(' '));
}
function gambarKartuKomen(akun, isi, like, cx, cy, kLike = 1, kabur = 0) {
  const w = 640, size = 27, br = bungkus(isi, size, w - 130), h = 104 + br.length * 36;
  const x = cx - w / 2, y = cy - h / 2;
  c.fillStyle = 'rgba(0,0,0,.25)'; rr(x, y + 7, w, h, 26); c.fill();
  c.fillStyle = '#fff'; rr(x, y, w, h, 26); c.fill();
  let hs = 0; for (const ch of akun) hs = (hs * 31 + ch.charCodeAt(0)) % 997;
  c.fillStyle = WARNA_AV[hs % WARNA_AV.length]; c.beginPath(); c.arc(x + 52, y + 50, 29, 0, Math.PI * 2); c.fill();
  teks((akun.replace('@', '')[0] || '?').toUpperCase(), x + 52, y + 52, { size: 30, warna: '#fff', bobot: 900 });
  if (kabur) c.filter = `blur(${9 * SKALA * kabur}px)`;
  teks(akun, x + 96, y + 38, { size: 23, warna: '#16181d', bobot: 800, align: 'left' });
  br.forEach((b, k) => teks(b, x + 96, y + 74 + k * 36, { size, warna: '#2b2f36', bobot: 600, align: 'left' }));
  c.filter = 'none';
  const n = Math.round(like * kLike).toLocaleString('id-ID');
  teks(`❤️ ${n}`, x + 96, y + h - 26, { size: 22, warna: '#e63946', bobot: 800, align: 'left' });
  teks('Balas', x + 96 + ukur(`❤️ ${n}`, 22) + 30, y + h - 26, { size: 21, warna: '#8a8f98', bobot: 700, align: 'left' });
  return h;
}
function kartuProtes(st, t, t0, ps) {
  const cy = st.y || 470, naik = st.naik ? 1 + Math.max(0, t - (st._naikT0 ?? t0)) * 0.06 : st.lanjut ? 1 : Math.min(1, 0.55 + (t - t0) / 1.2 * 0.45);
  let h = 0;
  denganSkala(W / 2, cy, ps, () => {
    const kb = !st.kabur ? 0 : st.buka == null ? 1 : 1 - Math.min(1, Math.max(0, (t - t0 - st.buka) / 0.6));
    h = gambarKartuKomen(st.akun, st.teks, st.like, W / 2, cy, naik, kb);
    if (st.kabur) {
      c.globalAlpha = kb;
      teks('???', W / 2, cy + 6, { size: 80, warna: KUNING, bobot: 900, garis: 16, warnaGaris: TEAL });
      c.globalAlpha = 1;
      pil(kb < 1 ? '🔓 KOMEN MISTERIUS' : '❤️ LIKE TERBANYAK', W / 2, cy - h / 2 - 26, 1, 'merah', 24);
    } else pil('💬 KOMEN WARGA', W / 2 - 195, cy - h / 2 - 6, 1, 'oren', 19, 18);
  });
  if (st.stempel != null) {          // stempel ✅ DIBANGUN mendarat di kartu
    const ts = st._s0 + st.stempel, u = (t - ts) / 0.3; if (u <= 0) return;
    const sk = u >= 1 ? 1 : 2.4 - 1.4 * easeOut(u);
    c.save(); c.globalAlpha = Math.min(1, u * 2); c.translate(W / 2 + 150, cy + 8); c.rotate(-0.16); c.scale(sk, sk);
    c.lineWidth = 7; c.strokeStyle = '#1f9d55'; c.fillStyle = 'rgba(255,255,255,.88)';
    const lb = st.teksStempel || '✅ DIBANGUN', w = ukur(lb, 40, 900) + 40;
    rr(-w / 2, -38, w, 76, 14); c.fill(); c.stroke();
    teks(lb, 0, 2, { size: 40, warna: '#1f9d55', bobot: 900 });
    c.restore();
  }
}
// kartu komen lanjutan yang like-nya terus naik: lanjutkan hitungan dari kartu yang sama di baris sebelumnya
SEG.forEach((s, i) => (s.stiker || []).forEach(st => {
  if (st.jenis !== 'protes' || !st.lanjut || !st.naik || i === 0) return;
  const lama = (SEG[i - 1].stiker || []).find(x => x.jenis === 'protes' && x.akun === st.akun);
  if (lama) { st._naikT0 = lama._naikT0 ?? lama._t0; st.like = lama.like; }
}));
function gambarStiker(st, s, i, t, slot) {
  const t0 = st._t0, ps = popS(t, t0);
  const y = 170 + slot * 110;
  switch (st.jenis) {
    case 'pil': return pil(st.teks, W / 2, st.y || y, ps, st.warna || 'kuning');
    case 'protes': return kartuProtes(st, t, t0, st.lanjut ? 1 : ps);
    case 'kertas': {          // kertas misterius bertulisan tangan, sebagian kabur
      const cx = W / 2, cy = st.y || 560;
      return denganSkala(cx, cy, st.lanjut ? 1 : ps, () => {
        c.save(); c.translate(cx, cy); c.rotate(-0.07);
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-250 + 8, -130 + 10, 500, 260);
        c.fillStyle = '#f3ead2'; c.fillRect(-250, -130, 500, 260);
        c.strokeStyle = 'rgba(120,150,200,.35)'; c.lineWidth = 2; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(-230, -70 + k * 46); c.lineTo(230, -70 + k * 46); c.stroke(); }
        teks('📝 PETUNJUK', -230, -102, { size: 24, warna: '#b5541b', align: 'left' });
        const br = (st.teks || '').split('|');
        br.forEach((b, k) => { if (st.kabur && k === br.length - 1) c.filter = `blur(${4 * SKALA}px)`; teks(b, -220, -40 + k * 50, { size: 40, warna: '#20304a', bobot: 700, align: 'left' }); c.filter = 'none'; });
        c.restore();
      });
    }
    case 'petunjuk': {        // kartu petunjuk bernomor, muncul satu per satu
      return st.items.forEach(([ik, lb], k) => {
        const tk = t0 + k * (st.jeda || 0.9), sk = (st.lanjut && k < (st.sudah || 0)) ? 1 : popS(t, tk); if (sk <= 0) return;
        const y = (st.y || 170) + k * 112;
        kartu(W / 2, y, 560, 92, sk, (x, yy) => {
          c.fillStyle = '#16324f'; c.beginPath(); c.arc(x + 50, yy + 46, 30, 0, Math.PI * 2); c.fill();
          teks(String(k + 1), x + 50, yy + 48, { size: 30, warna: KUNING });
          teks(ik, x + 118, yy + 48, { size: 42 });
          teks(lb, x + 165, yy + 48, { size: 30, warna: '#16324f', align: 'left' });
        }, { bg: KREM, tepi: OREN });
      });
    }   // lanjut = kartu dari baris sebelumnya, tidak muncul ulang
    case 'nota': {            // nota pengeluaran: baris muncul satu per satu, lalu TOTAL + cap
      const cx = W / 2, cy = st.y || 520, n = st.items.length, hh = 150 + n * 54;
      return denganSkala(cx, cy, st.lanjut ? 1 : ps, () => {
        c.save(); c.translate(cx, cy); c.rotate(-0.035);
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-270 + 8, -hh / 2 + 10, 540, hh);
        c.fillStyle = '#fdfbf4'; c.fillRect(-270, -hh / 2, 540, hh);
        for (let x = -270; x < 270; x += 20) { c.beginPath(); c.moveTo(x, hh / 2); c.lineTo(x + 10, hh / 2 + 10); c.lineTo(x + 20, hh / 2); c.fillStyle = '#fdfbf4'; c.fill(); }
        teks(st.judul || '🧾 NOTA PEMBANGUNAN', 0, -hh / 2 + 36, { size: 30, warna: '#16324f' });
        c.strokeStyle = '#9aa5b1'; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(-240, -hh / 2 + 62); c.lineTo(240, -hh / 2 + 62); c.stroke(); c.setLineDash([]);
        st.items.forEach(([lb, rp], k) => {
          const tk = t0 + 0.2 + k * (st.jeda || 0.45); if (!st.lanjut && t < tk) return;
          const y = -hh / 2 + 96 + k * 54;
          teks(lb, -240, y, { size: 28, warna: '#20304a', bobot: 700, align: 'left' });
          teks(rp, 240, y, { size: 28, warna: '#20304a', bobot: 700, align: 'right' });
        });
        const tt = t0 + 0.2 + n * (st.jeda || 0.45) + 0.3;
        if (st.lanjut || t >= tt) {
          c.strokeStyle = '#20304a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-240, hh / 2 - 58); c.lineTo(240, hh / 2 - 58); c.stroke();
          teks('TOTAL', -240, hh / 2 - 30, { size: 32, warna: '#d62828', align: 'left' });
          teks(st.total || '', 240, hh / 2 - 30, { size: 32, warna: '#d62828', align: 'right' });
        }
        if (st.cap && (st.lanjut || t >= tt + 0.5)) {
          const sc = st.lanjut ? 1 : popS(t, tt + 0.5, 0.22);
          c.save(); c.translate(110, -10); c.rotate(-0.25);
          denganSkala(0, 0, sc, () => { const w = ukur(st.cap, 40) + 40; c.lineWidth = 7; c.strokeStyle = '#d62828'; rr(-w / 2, -40, w, 80, 14); c.stroke(); teks(st.cap, 0, 2, { size: 40, warna: '#d62828' }); });
          c.restore();
        }
        c.restore();
      });
    }
    case 'angka': {           // penghitung bebas: {pre, post, dari, ke, lama}
      const u = Math.min(1, Math.max(0, (t - t0 - 0.2) / (st.lama || 2))), v = Math.round((st.dari || 0) + ((st.ke || 0) - (st.dari || 0)) * ease(u));
      return pil((st.pre || '') + v.toLocaleString('id-ID') + (st.post || ''), W / 2, st.y || 640, (st.lanjut ? 1 : ps) * (1 + 0.05 * Math.max(0, Math.sin(t * 9)) * (u < 1 ? 1 : 0)), st.warna || 'oren', st.size || 46);
    }
    case 'kas': {             // penghitung KAS KOTA yang naik dari "dari" ke "ke"
      const u = Math.min(1, Math.max(0, (t - t0 - 0.3) / (st.lama || 1.6))), v = Math.round(((st.dari || 0) + ((st.ke || 0) - (st.dari || 0)) * ease(u)) / 1000) * 1000;
      const lbl = '💰 KAS KOTA: Rp' + v.toLocaleString('id-ID');
      return pil(lbl, W / 2, st.y || 640, (st.lanjut ? 1 : ps) * (1 + 0.06 * Math.max(0, Math.sin(t * 9)) * (u < 1 ? 1 : 0)), st.warna || 'kuning', st.size || 46);
    }
    case 'hitung': {          // penghitung rumah terisi, mis. "🏠 3/6 TERISI"
      const n = window._nIsi || 0, tot = st.total || 6, kd = (st.lanjut ? 1 : popS(t, t0)) * (1 + 0.08 * Math.max(0, Math.sin(t * 8)));
      return pil(`🏠 ${n}/${tot} TERISI${n >= tot ? ' · PENUH!' : ''}`, W / 2, st.y || 600, kd, n >= tot - 1 ? 'merah' : 'kuning', 40);
    }
    case 'tumpuk': {          // kartu komen protes berjatuhan menumpuk
      st.items.forEach((it, k) => {
        const tk = t0 + k * 0.22, u = (t - tk) / 0.45; if (u <= 0) return;
        const e = easeOut(Math.min(1, u)), x0 = [230, 470, 330, 520, 190, 420][k % 6], y1 = 1150 + (k % 3) * 45 - Math.floor(k / 3) * 30;
        const rot = [-0.12, 0.09, -0.05, 0.14, 0.04, -0.1][k % 6] * e;
        c.save(); c.translate(x0, -200 + (y1 + 200) * e); c.rotate(rot); c.scale(0.62, 0.62);
        gambarKartuKomen(it[0], it[1], it[2], 0, 0, 1, false); c.restore();
      });
      return;
    }
    case 'papan': return pil(st.teks, W / 2, y, ps, 'oren', 34);
    case 'url': return pil(st.teks, W / 2, st.y || 230, ps, 'teal', 34);
    case 'kartu_teks': {
      const size = pas(st.teks, 84, 520);
      return kartu(W / 2, 300, Math.max(360, ukur(st.teks, size) + 100), 170, ps, (x, yy) => teks(st.teks, W / 2, yy + 88, { size, warna: TEAL }), { bg: KREM });
    }
    case 'judul': {
      const s2 = popS(t, t0 + 0.55, 0.35), ts = pas(st.teks, 80, 640);
      if (st.atas) denganSkala(W / 2, 290, ps, () => teks(st.atas, W / 2, 290, { size: 44, warna: '#fff', garis: 12 }));
      denganSkala(W / 2, 370, st.atas ? s2 : ps, () => teks(st.teks, W / 2, 370, { size: ts, warna: KUNING, garis: 18 }));
      if (st.sub) denganSkala(W / 2, 450, popS(t, t0 + 1.0, 0.3), () => pil(st.sub, W / 2, 450, 1, 'putih', 30, 22));
      return;
    }
    case 'kenalan':           // template perkenalan: "iki SidoarjoVerse, kota impian sing dibangun teko komen kalian"
      return kartu(W / 2, st.y || 250, 620, 150, ps, (x, yy) => {
        c.fillStyle = TEAL; rr(x, yy, 620, 52, [24, 24, 0, 0]); c.fill();
        teks('🏙️ KENALAN SIK, REK!', x + 310, yy + 28, { size: 26, warna: KUNING });
        teks(st.judul || 'SidoarjoVerse', x + 310, yy + 82, { size: 36, warna: '#16324f', bobot: 900 });
        teks(st.sub || 'kota impian sing dibangun teko komen kalian 💬', x + 310, yy + 124, { size: 22, warna: '#5b7083', bobot: 700 });
      }, { bg: KREM });
    case 'follow':
      return kartu(W / 2, 282, 600, 104, ps, (x, yy) => {
        c.fillStyle = TEAL; c.beginPath(); c.arc(x + 58, yy + 52, 34, 0, Math.PI * 2); c.fill();
        teks('🐟', x + 58, yy + 54, { size: 34 });
        teks('@sidoarjoverse', x + 106, yy + 38, { size: 27, warna: '#16324f', align: 'left' });
        teks('Kota Delta dari komen kamu', x + 106, yy + 72, { size: 19, warna: '#5b7083', bobot: 500, align: 'left' });
        const ikut = t > t0 + 1.0;
        c.fillStyle = ikut ? '#e8eef1' : '#3a86ff'; rr(x + 420, yy + 30, 160, 46, 14); c.fill();
        teks(ikut ? 'Mengikuti ✓' : 'Ikuti', x + 500, yy + 54, { size: 21, warna: ikut ? '#16324f' : '#fff' });
      });
    case 'aturan':
      return kartu(W / 2, 300, 600, 250, ps, (x, yy) => {
        c.fillStyle = TEAL; rr(x, yy, 600, 66, [26, 26, 0, 0]); c.fill();
        teks(st.judul || '📜 ATURAN KOTA No. 1', x + 300, yy + 35, { size: 32, warna: KUNING });
        teks(st.baris1 || 'Komen ❤️ like terbanyak', x + 300, yy + 118, { size: pas(st.baris1 || 'Komen ❤️ like terbanyak', 38, 560), warna: '#16324f' });
        const t2 = s.start + s.dur * 0.45;
        if (t >= t2) denganSkala(x + 300, yy + 190, popS(t, t2), () => teks(st.baris2 || '→ BESOK DIBANGUN 🏗️', x + 300, yy + 190, { size: pas(st.baris2 || '→ BESOK DIBANGUN 🏗️', 40, 560), warna: OREN }));
      }, { bg: KREM });
    case 'stempel': {
      const t2 = s.start + s.dur * 0.8; if (t < t2) return;
      const sc = popS(t, t2, 0.22) * (1 + Math.max(0, 0.6 - (t - t2)) * 0.6);
      c.save(); c.translate(W / 2 + 110, 470); c.rotate(-0.16);
      denganSkala(0, 0, sc, () => { const sz = pas(st.teks, 38, 380); const w = ukur(st.teks, sz) + 40; c.lineWidth = 7; c.strokeStyle = '#d62828'; rr(-w / 2, -40, w, 80, 14); c.stroke(); teks(st.teks, 0, 2, { size: sz, warna: '#d62828' }); });
      c.restore(); return;
    }
    case 'ide':
      return st.items.forEach((str, k) => { const [x, yy] = POS_IDE[k % POS_IDE.length]; pil(str, x, yy, popS(t, s.start + 0.2 + k * s.dur * 0.18), 'putih', 30, 20); });
    case 'komen':
      return st.items.forEach(([u, kk], k) => {
        const tk = t0 + 0.3 + k * 0.5, kiri = k % 2 === 0;
        const w = Math.max(ukur(kk, 26, 600), ukur(u, 21)) + 110, cx = kiri ? 40 + w / 2 : W - 40 - w / 2, cy = (st.y || 290) + k * 100;
        kartu(cx, cy, w, 80, popS(t, tk), (x, yy) => {
          c.fillStyle = ['#f4a261', '#2a9d8f', '#8d5a97', '#e9c46a'][k % 4]; c.beginPath(); c.arc(x + 40, yy + 40, 22, 0, Math.PI * 2); c.fill();
          teks(u, x + 74, yy + 26, { size: 21, warna: '#5b7083', align: 'left' });
          teks(kk, x + 74, yy + 55, { size: 26, warna: '#16324f', bobot: 600, align: 'left' });
        }, { tepi: '#e7dcc8' });
      });
    case 'konfeti':
      for (const k of KONFETI) {
        const u = t - t0 - k.d; if (u < 0 || u > 2.4) continue;
        const yy = -30 + u * k.v, x = k.x + Math.sin(u * 3 + k.r) * 30;
        c.save(); c.translate(x, yy); c.rotate((k.r + u * 240) * Math.PI / 180); c.fillStyle = k.col; c.fillRect(-k.w / 2, -k.w / 4, k.w, k.w / 2); c.restore();
      }
      return;
    case 'klasemen': {
      const rows = st.rows || [];
      return kartu(W / 2, 330, 560, 120 + rows.length * 74, ps, (x, yy) => {
        c.fillStyle = TEAL; rr(x, yy, 560, 70, [26, 26, 0, 0]); c.fill();
        teks(st.judul || '🏆 KLASEMEN KECAMATAN', x + 280, yy + 37, { size: 30, warna: KUNING });
        const maks = Math.max(1, ...rows.map(r => r[1]));
        rows.forEach(([nm, n], k) => {
          const y0 = yy + 92 + k * 74, muncul = popS(t, t0 + 0.25 + k * 0.18);
          if (muncul <= 0) return;
          c.globalAlpha = Math.min(1, muncul);
          teks(k === 0 ? '🥇' : `${k + 1}.`, x + 46, y0 + 22, { size: 30, warna: '#16324f' });
          teks(nm, x + 86, y0 + 10, { size: 28, warna: '#16324f', align: 'left' });
          c.fillStyle = '#eadfcb'; rr(x + 86, y0 + 32, 330, 14, 7); c.fill();
          c.fillStyle = k === 0 ? OREN : '#2a9d8f'; rr(x + 86, y0 + 32, 330 * (n / maks) * Math.min(1, (t - t0) / 0.8), 14, 7); c.fill();
          teks(`${n} warga`, x + 520, y0 + 24, { size: 24, warna: '#5b7083', align: 'right', bobot: 700 });
          c.globalAlpha = 1;
        });
      }, { bg: KREM });
    }
    case 'layar': {
      const img = GAMBAR[st.gambar]; if (!img) return;
      const w = 400, h = w * img.height / img.width, cx = W / 2, cy = st.y || 560;
      denganSkala(cx, cy, ps, () => {
        c.save(); c.translate(cx, cy); c.rotate((st.miring || -0.03));
        c.fillStyle = 'rgba(0,0,0,.28)'; rr(-w / 2 - 14 + 10, -h / 2 - 56 + 16, w + 28, h + 84, 46); c.fill();
        c.fillStyle = '#16181d'; rr(-w / 2 - 14, -h / 2 - 56, w + 28, h + 84, 46); c.fill();
        c.fillStyle = '#f1f3f4'; rr(-w / 2, -h / 2 - 44, w, 40, [14, 14, 0, 0]); c.fill();
        teks('🔒 sidoarjoverse.github.io', 0, -h / 2 - 24, { size: 17, warna: '#3c4043', bobot: 600 });
        c.save(); rr(-w / 2, -h / 2 - 4, w, h, [0, 0, 14, 14]); c.clip(); c.drawImage(img, -w / 2, -h / 2 - 4, w, h); c.restore();
        if (st.ketuk) {          // lingkaran "ketuk" di posisi tombol (0..1 relatif gambar)
          const [fx, fy] = st.ketuk, px = -w / 2 + fx * w, py = -h / 2 - 4 + fy * h, u = ((t - t0) % 1.2) / 1.2;
          c.strokeStyle = `rgba(242,140,40,${1 - u})`; c.lineWidth = 6; c.beginPath(); c.arc(px, py, 18 + u * 30, 0, Math.PI * 2); c.stroke();
          c.fillStyle = 'rgba(242,140,40,.85)'; c.beginPath(); c.arc(px, py, 14, 0, Math.PI * 2); c.fill();
        }
        c.restore();
      });
      if (st.label) pil(st.label, W / 2, 170, popS(t, t0 + 0.2), 'teal', 34);
      return;
    }
    case 'headline': {          // teks besar kiri atas; kata *bintang* kuning, muncul kata demi kata
      const kata = st.teks.split(' '), size = st.size || 56, maks = 620, lh = size * 1.18;
      const baris = [[]]; let lw = 0;
      for (const k of kata) { const w = ukur(k.replace(/\*/g, '') + ' ', size, 900); if (lw + w > maks && baris[baris.length - 1].length) { baris.push([]); lw = 0; } baris[baris.length - 1].push(k); lw += w; }
      let idx = 0;
      baris.forEach((br, bi) => {
        let x = 44; const yy = (st.y || 150) + bi * lh;
        for (const k of br) {
          const tk = t0 + idx * 0.07; idx++;
          const a = Math.min(1, Math.max(0, (t - tk) / 0.15)); if (a <= 0) continue;
          const bersih = k.replace(/\*/g, ''), sorot = k.includes('*');
          c.globalAlpha = a;
          teks(bersih, x, yy + (1 - a) * 18, { size, warna: sorot ? KUNING : '#fff', bobot: 900, align: 'left', garis: 12, warnaGaris: 'rgba(10,40,55,.85)' });
          c.globalAlpha = 1;
          x += ukur(bersih + ' ', size, 900);
        }
      });
      return;
    }
    case 'langkah': {           // kartu langkah bernomor; langkah sebelumnya tampil redup + ✓
      for (let k = 1; k <= st.no; k++) {
        const ini = k === st.no, cy = (st.y || 800) + (k - 1) * 122;
        const label = ini ? st.teks : (NASKAH.baris.flatMap(b => b.stiker || []).find(x => x.jenis === 'langkah' && x.no === k) || {}).teks || '';
        const sc = ini ? ps : 1;
        c.globalAlpha = ini ? 1 : 0.72;
        kartu(W / 2, cy, 620, 108, sc, (x, yy) => {
          c.fillStyle = ini ? OREN : '#2a9d8f'; c.beginPath(); c.arc(x + 62, yy + 54, 36, 0, Math.PI * 2); c.fill();
          teks(ini ? String(k) : '✓', x + 62, yy + 56, { size: 38, warna: '#fff', bobot: 900 });
          const sz = pas(label, 34, ini && st.follow ? 330 : 470, 800);
          teks(label, x + 118, yy + 56, { size: sz, warna: '#16324f', align: 'left' });
          if (ini && st.follow) { const ikut = t > t0 + 1.1; c.fillStyle = ikut ? '#e8eef1' : '#3a86ff'; rr(x + 456, yy + 31, 144, 46, 14); c.fill(); teks(ikut ? 'Mengikuti ✓' : 'Ikuti', x + 528, yy + 55, { size: 20, warna: ikut ? '#16324f' : '#fff' }); }
          if (ini && st.ktp) teks('🪪', x + 560, yy + 56, { size: 50 });
        }, { bg: KREM });
        c.globalAlpha = 1;
      }
      return;
    }
    case 'chip':                // daftar fitur kiri, muncul satu per satu
      return st.items.forEach((str, k) => {
        const tk = st.lanjut && k === 0 ? -99 : t0 + (st.lanjut ? k - 1 : k) * 0.45;
        const sc = popS(t, tk); if (sc <= 0) return;
        const size = 32, w = ukur(str, size) + 52, cy = (st.y || 330) + k * 84;
        denganSkala(44 + w / 2, cy, sc, () => { c.fillStyle = 'rgba(15,76,92,.92)'; rr(44, cy - 34, w, 68, 34); c.fill(); teks(str, 44 + w / 2, cy + 2, { size, warna: '#fff' }); });
      });
    case 'tangga': {            // tangga jabatan: penanda "kamu" naik dari bawah ke atas
      const nItem = st.items.length, y0 = st.y || 820, dy = 120;
      st.items.forEach((str, k) => {
        const cy = y0 - k * dy, cx = 210 + k * 70, tk = t0 + k * 0.35, sc = popS(t, tk); if (sc <= 0) return;
        const w = ukur(str, 32) + 56, puncak = k === nItem - 1;
        denganSkala(cx, cy, sc, () => { c.fillStyle = puncak ? KUNING : '#ffffff'; rr(cx - w / 2, cy - 36, w, 72, 20); c.fill(); c.lineWidth = 4; c.strokeStyle = TEAL; c.stroke(); teks(str, cx, cy + 2, { size: 32, warna: TEAL }); });
        if (k > 0 && sc > 0.9) teks('▲', 210 + (k - 0.5) * 70, y0 - (k - 0.5) * dy, { size: 26, warna: '#fff', garis: 6, warnaGaris: TEAL });
      });
      const u = Math.min(nItem - 1, Math.max(0, (t - t0 - 0.6) / ((s.dur - 0.8) / (nItem - 1))));
      const k0 = Math.floor(u), f2 = ease(u - k0), k1 = Math.min(nItem - 1, k0 + 1), kk = k0 + (k1 - k0) * f2;
      const cx = 210 + kk * 70, cy = y0 - kk * dy, w = ukur(st.items[Math.round(kk)], 32) + 56;
      if (t > t0 + 0.4) pil('⬅ kamu', cx + w / 2 + 90, cy, popS(t, t0 + 0.4), 'oren', 28, 18);
      return;
    }
    case 'voting': {            // kartu LIVE: bar suara bertambah, pemenang dapat mahkota
      const it = st.items, maks = Math.max(...it.map(x => x[1])), cy = st.y || 560, hh = 100 + it.length * 92;
      const prog = Math.min(1, Math.max(0, (t - t0 - 0.3) / 2.2)), menang = prog >= 1;
      return kartu(W / 2, cy, 600, hh, ps, (x, yy) => {
        c.fillStyle = TEAL; rr(x, yy, 600, 70, [26, 26, 0, 0]); c.fill();
        c.fillStyle = (Math.floor(t * 2) % 2) ? '#e63946' : '#ff6b6b'; c.beginPath(); c.arc(x + 40, yy + 35, 11, 0, Math.PI * 2); c.fill();
        teks('LIVE · KOMEN = SUARA', x + 300, yy + 37, { size: 28, warna: KUNING });
        it.forEach(([nm, n], k) => {
          const y0 = yy + 92 + k * 92, juara = menang && n === maks, nn = Math.round(n * ease(prog));
          if (juara) { c.fillStyle = 'rgba(255,209,102,.35)'; rr(x + 14, y0 - 12, 572, 84, 18); c.fill(); }
          teks(nm + (juara ? '  👑' : ''), x + 34, y0 + 14, { size: 30, warna: '#16324f', align: 'left' });
          c.fillStyle = '#eadfcb'; rr(x + 34, y0 + 42, 430, 18, 9); c.fill();
          c.fillStyle = juara ? OREN : '#2a9d8f'; rr(x + 34, y0 + 42, Math.max(18, 430 * (n / maks) * ease(prog)), 18, 9); c.fill();
          teks(`❤️ ${nn}`, x + 566, y0 + 50, { size: 26, warna: '#5b7083', align: 'right', bobot: 700 });
        });
      }, { bg: KREM });
    }
    case 'lahan': {
      if (t < s.start + s.dur * 0.4) return;
      const [px, py] = proyeksi(V(+lahanB.x, 0.5, +lahanB.z));
      return denganSkala(px, py, popS(t, s.start + s.dur * 0.4, 0.35), () => teks('???', px, py, { size: 120, warna: '#fff', garis: 16, warnaGaris: OREN }));
    }
  }
}

function overlay(t) {
  c.save(); c.scale(SKALA, SKALA);
  if (NASKAH.day != null) {   // lencana DAY di kiri atas, akun di kanan atas
    const lb = `DAY ${NASKAH.day}`; const lw = ukur(lb, 30) + 36;
    c.fillStyle = '#16181d'; rr(36, 40, lw, 52, 14); c.fill(); teks(lb, 36 + lw / 2, 67, { size: 30, warna: KUNING });
    if (NASKAH.episode != null) {   // lencana EPS kecil di samping DAY, selama video
      const le = `EPS ${NASKAH.episode}`, ew = ukur(le, 26) + 30;
      c.fillStyle = OREN; rr(36 + lw + 12, 43, ew, 46, 13); c.fill(); teks(le, 36 + lw + 12 + ew / 2, 67, { size: 26, warna: '#fff' });
    }
    teks('@sidoarjoverse', W - 40, 66, { size: 24, warna: 'rgba(255,255,255,.92)', align: 'right', garis: 6, warnaGaris: 'rgba(15,76,92,.6)' });
  } else teks('@sidoarjoverse', 40, 64, { size: 26, warna: 'rgba(255,255,255,.92)', align: 'left', garis: 6, warnaGaris: 'rgba(15,76,92,.6)' });
  if (NASKAH.episode != null && t < 2.6) {   // aturan: setiap video dibuka dengan keterangan episode
    const k = popS(t, 0.05, 0.4), keluar = t > 2.2 ? Math.max(0, 1 - (t - 2.2) / 0.4) : 1;
    c.save(); c.globalAlpha = keluar;
    denganSkala(W / 2, 395, k, () => {
      const lb = `EPISODE ${NASKAH.episode}`, w = ukur(lb, 64, 900) + 90;
      c.fillStyle = 'rgba(15,76,92,.94)'; rr(W / 2 - w / 2, 340, w, 110, 30); c.fill();
      c.strokeStyle = KUNING; c.lineWidth = 6; c.stroke();
      teks(lb, W / 2, 398, { size: 64, warna: KUNING, bobot: 900 });
      if (NASKAH.seri) teks(NASKAH.seri, W / 2, 482, { size: 32, warna: '#fff', garis: 8, warnaGaris: 'rgba(15,76,92,.8)' });
    });
    c.restore();
  }
  const i = segPada(t), s = SEG[i];
  let slot = 0;
  for (const st of s.stiker || []) { if (t >= st._t0) gambarStiker(st, s, i, t, slot); if (['pil', 'papan'].includes(st.jenis)) slot++; }
  // krik-krik di jeda setelah baris
  if (i > 0 && SEG[i - 1].sfx === 'krik' && t < s.start) {
    const u = t - (SEG[i - 1].start + SEG[i - 1].dur);
    c.globalAlpha = Math.min(1, u / 0.3);
    teks('krik… krik… 🦗', W / 2 + Math.sin(t * 9) * 4, 640, { size: 46, warna: '#fff', bobot: 700, garis: 10, warnaGaris: 'rgba(0,0,0,.35)' });
    c.globalAlpha = 1;
  }
  subtitle(t);
  c.restore();
}

// ------------------------------------------------------------ API untuk perekam
let tPrev = 0;
let kabutSkr = null;
// tampilan rekaman handycam (found footage): REC, waktu rekam, tanggal, baterai, bingkai, bintik film, glitch saat ganti adegan
const BINTIK = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), im = g.createImageData(256, 256), r = rng('bintik');
  for (let k = 0; k < im.data.length; k += 4) { const v = Math.floor(r() * 255); im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255; } g.putImageData(im, 0, 0); return cv; })();
function handycam(t, s, i) {
  c.save(); c.globalAlpha = 0.07; c.globalCompositeOperation = 'overlay';
  const ox = (t * 977) % 256, oy = (t * 613) % 256; for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) c.drawImage(BINTIK, x, y);
  c.restore();
  const m = 46, pj = 54; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 4;
  for (const [x, y, sx, sy] of [[m, m + 60, 1, 1], [W - m, m + 60, -1, 1], [m, H - m - 60, 1, -1], [W - m, H - m - 60, -1, -1]]) { c.beginPath(); c.moveTo(x, y + sy * pj); c.lineTo(x, y); c.lineTo(x + sx * pj, y); c.stroke(); }
  const bayang = (f) => { c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 6; f(); c.restore(); };
  bayang(() => {
    if (Math.floor(t * 1.4) % 2 === 0) { c.fillStyle = '#ff2b2b'; c.beginPath(); c.arc(m + 34, m + 104, 13, 0, 7); c.fill(); }
    teks('REC', m + 58, m + 104, { size: 34, warna: '#fff', align: 'left', bobot: 800 });
    const dtk = Math.floor(t), tc = `00:${String(Math.floor(dtk / 60)).padStart(2, '0')}:${String(dtk % 60).padStart(2, '0')}`;
    teks(tc, W - m - 14, m + 104, { size: 30, warna: '#fff', align: 'right', bobot: 700 });
    teks(NASKAH.tanggalRekam || '16 NOV 2026', m + 18, H - m - 92, { size: 26, warna: '#fff', align: 'left', bobot: 700 });
    teks(s.jamRekam || '', W - m - 14, H - m - 92, { size: 26, warna: '#fff', align: 'right', bobot: 700 });
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(W - m - 70, m + 128, 50, 22); c.fillStyle = '#fff'; c.fillRect(W - m - 20, m + 134, 5, 10);
    const bat = Math.max(1, 4 - Math.floor(t / (TL.durasi / 4))); for (let k = 0; k < bat; k++) c.fillRect(W - m - 66 + k * 11.5, m + 132, 9, 14);
  });
  const g0 = s.glitch ? (t - mulai(i)) : 9;
  if (g0 >= 0 && g0 < 0.4) {   // glitch ganti adegan
    const r = rng('g' + Math.floor(t * 30));
    for (let k = 0; k < 9; k++) { const y = r() * H, hh = 8 + r() * 60, dx = (r() - 0.5) * 120; c.drawImage(out, 0, y * SKALA, out.width, hh * SKALA, dx, y, W, hh); }
    c.fillStyle = `rgba(255,255,255,${0.25 * (1 - g0 / 0.4)})`; c.fillRect(0, 0, W, H);
  }
}
window.video = {
  N, FPS, durasi: TL.durasi, sfx,
  render(f, mutu = 0.9) {
    const t = f / FPS, dt = Math.max(0, t - tPrev); tPrev = t;
    animDarjo(t, f);
    const i = segPada(t), s = SEG[i];
    const ada = (s.stiker || []).some(x => x.jenis === 'lahan');
    const ks = (t - s.start - 0.3) / 0.5;
    sorot.visible = ada && ks > 0;
    sorot.material.opacity = Math.min(1, Math.max(0, ks)) * (0.42 + Math.sin(t * 6) * 0.14);
    { const kb = s.kabut ?? NASKAH.kabut ?? 1; if (kb !== kabutSkr) { kabutSkr = kb; world.setKabut(kb); } }   // kabut per baris (shot sinematik jernih)
    kamera(t);
    if (s.getar != null) {           // layar bergetar (kaget)
      const u = t - (s.start + s.dur * s.getar);
      if (u > 0 && u < 1.1) { const a = 0.35 * (1 - u / 1.1); camera.position.x += Math.sin(t * 91) * a; camera.position.y += Math.sin(t * 73) * a * 0.7; }
    }
    aturHantu(t, s); aturCahaya(t, s); aturRumah(t, i); aturKerumunan(t, s);
    { const jm = NASKAH.jam ?? 9.3, gelap = (jm > 18.5 || jm < 5.5) && s.darjo !== 'pojok'; lampuDarjo.intensity = gelap && !s.footage ? 16 : 0; }
    senter.intensity = s.footage ? 40 : 0;
    if (!s.footage) { const a = darjo.userData.anim; a.legs[0].rotation.x = a.legs[1].rotation.x = 0; }
    const pj = s.darjo === 'pojok';
    if (s.darjo === 'tidak') { if (darjo.parent) darjo.parent.remove(darjo); }
    const diDalam = DALAM && SHOT[i].dalam;
    if (s.darjo === 'tidak') { /* tanpa Cak Darjo (shot sinematik murni) */ }
    else if (pj) { scPojok.add(darjo); darjo.position.set(0, darjo.position.y, 0); darjo.rotation.y = -0.35; }
    else if (s.footage) {          // Cak Darjo ronda di lokasi (adegan rekaman CCTV)
      const f = s.footage, u = (t - mulai(i)) / (selesai(i) - mulai(i));
      scene.add(darjo);
      let x = f.dari[0], z = f.dari[1], ry = f.ry ?? Math.PI, lompat = 0, lari = 0;
      const jalanK = Math.min(1, u / (f.jalan ?? 0.6)); x += (f.ke[0] - f.dari[0]) * ease(jalanK); z += (f.ke[1] - f.dari[1]) * ease(jalanK);
      const melangkah = f.jalan != null && u < f.jalan;
      if (f.kaget != null && u >= f.kaget) {
        const v = u - f.kaget; lompat = Math.max(0, Math.sin(Math.min(1, v * 6) * Math.PI)) * 0.9;
        if (v > (f.diam ?? 0.3)) { lari = (v - (f.diam ?? 0.3)) * (selesai(i) - mulai(i)) * (f.cepat || 4.5); ry = 0.15; }
      }
      darjo.position.set(x + lari * 0.35, lompat + (melangkah || lari ? Math.abs(Math.sin(t * 11)) * 0.06 : 0), z + lari);
      darjo.rotation.y = ry;
      const a = darjo.userData.anim, sw = lari ? Math.sin(t * 22) * 1.1 : melangkah ? Math.sin(t * 9) * 0.5 : 0;
      a.legs[0].rotation.x = sw; a.legs[1].rotation.x = -sw;
      if (lari) { tangan.rotation.set(-sw, 0, 0.3); if (tanganKiri) tanganKiri.rotation.set(sw, 0, -0.3); }
    }
    else if (s.darjoDi) { scene.add(darjo); const [dx, dz, dry, dy] = s.darjoDi; darjo.position.set(dx, (dy || 0) + darjo.position.y, dz); darjo.rotation.y = dry || 0; }   // Cak Darjo berdiri di lokasi mana pun (mis. vlog selfie)
    else if (diDalam) { DALAM.scene.add(darjo); darjo.position.set(-1.75, darjo.position.y, 2.9); darjo.rotation.y = 0.3; }
    else { scene.add(darjo); darjo.position.set(0, darjo.position.y, 0.6); darjo.rotation.y = 0; }
    // siang → malam (naskah "malam": true)
    // jam per baris (naskah "jam": [[fraksi, jam], ...]) → siang/malam berganti di tengah kalimat
    if (s.jam) {
      const u = (t - s.start) / s.dur, kf = s.jam; let h = kf[0][1];
      for (let k = 1; k < kf.length; k++) if (u >= kf[k - 1][0]) h = kf[k - 1][1] + (kf[k][1] - kf[k - 1][1]) * ease((u - kf[k - 1][0]) / (kf[k][0] - kf[k - 1][0]));
      world.setJam(h);
    } else if (i > 0 && SEG[i - 1].jam) world.setJam(NASKAH.jam ?? 9.3);
    // avatar "@kamu" muncul, lalu label namanya muncul
    if (kamu) {
      const muncul = s.muncul === 'avatar' ? popS(t, s.start + 1.6, 0.4) : 1;
      kamu.g.scale.setScalar(kamu._s * Math.max(0.0001, muncul));
      if (kamu._lbl) {
        const ls = s.muncul === 'avatar' ? 0 : s.muncul === 'label' ? popS(t, s.start + 0.6, 0.35) : 1;
        kamu._lbl.scale.copy(kamu._ls).multiplyScalar(Math.max(0.0001, ls));
      }
    }
    // saat kamera dekat, sembunyikan warga yang lewat di antara kamera dan Cak Darjo
    const dekat = /^(closeup|medium|ayam)/.test(String(s.kamera || 'closeup'));
    for (const ch of world.karakter()) {
      if (ch.g === world.maskot().g) continue;
      const p = ch.g.position;
      ch.g.visible = !(dekat && p.z > 0.0 && Math.abs(p.x) < 4.5) && !s.footage;
      const label = ch.g.children.find(o => o.isSprite);          // label nama terlalu dekat → terlalu besar di layar
      if (label) label.visible = !(dekat && Math.hypot(p.x, p.z - 0.6) < 7) && ch.g.position.distanceTo(camera.position) > 9 && !String(s.kamera).startsWith('cctv');
    }
    for (const l of labelBangunan) { l.getWorldPosition(_wp); l.visible = /^(warga|sinema|cctv)/.test(String(s.kamera)) ? false : _wp.distanceTo(camera.position) > 13; }
    aturJalan(t); aturTamu(t);
    { const u = (t - s.start) / s.dur, kh = s.hujan != null ? Math.min(1, Math.max(0, (u - s.hujan) / 0.08)) * (s.hujanKuat ?? 1) : 0; if (Math.abs(world.hujan() - kh) > 0.01) world.setHujan(kh); }
    world.setLampuMati(!!s.lampuMati || (s.kedip && (Math.sin(t * 29) + Math.sin(t * 13.7) > 0.4 || (t * 7) % 3 < 0.5)));
    const nIsi = aturPenghuni(t); window._nIsi = nIsi;
    if (NASKAH.tanpaPapan && !s.papanRumah) scene.traverse(o => { if (o.userData && o.userData.papanRumah) o.userData.papanRumah.visible = false; });
    aturIwak(t); aturPemancing(t, s); aturPenonton(t);
    world.frame(Math.min(dt, 0.05) || 1 / FPS, t);
    if (diDalam) {
      if (DALAM.ch) { DALAM.ch.position.y = Math.abs(Math.sin(t * 2.2)) * 0.02; if (DALAM.tangan) DALAM.tangan.rotation.z = t % 5 < 1.8 ? 2.4 + Math.sin(t * 12) * 0.35 : 0; }
      renderer.render(DALAM.scene, DALAM.cam);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    const cctv = SHOT[i].cctv;
    if (cctv) c.filter = `grayscale(0.75) contrast(1.25) brightness(${NASKAH.cctvTerang || 1.7}) sepia(0.25) hue-rotate(60deg)`;
    c.drawImage(gl, 0, 0, out.width, out.height);
    c.filter = 'none';
    if (cctv) {                       // tampilan rekaman kamera pengawas
      c.save(); c.scale(SKALA, SKALA);
      c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = (t * 60) % 4; y < H; y += 4) c.fillRect(0, y, W, 1.4);
      for (let k = 0; k < 220; k++) { const h = Math.sin(k * 12.9898 + Math.floor(t * 30) * 78.233) * 43758.5453; const r = h - Math.floor(h); c.fillStyle = `rgba(255,255,255,${0.05 + r * 0.08})`; c.fillRect((r * 9973) % W, (r * 7919 * 3) % H, 2, 2); }
      const yb = 128;
      if (Math.floor(t * 2) % 2 === 0) { c.fillStyle = '#ff2b2b'; c.beginPath(); c.arc(56, yb, 11, 0, Math.PI * 2); c.fill(); }
      teks('REC', 76, yb + 1, { size: 26, warna: '#fff', bobot: 800, align: 'left', garis: 5, warnaGaris: 'rgba(0,0,0,.6)' });
      teks(NASKAH.cctvLabel || 'CAM 03 · BLOK A', W - 40, yb + 1, { size: 24, warna: '#fff', bobot: 700, align: 'right', garis: 5, warnaGaris: 'rgba(0,0,0,.6)' });
      const i0 = SHOT.findIndex(x => x.cctv), dtk = Math.floor(t - mulai(i0)) + (NASKAH.cctvDetik || 13);
      const kotak = (obj, h, lb, warna) => {            // kotak pelacak ala CCTV
        const [x1, y1] = proyeksi(obj.position.clone().add(V(0, h, 0))), [x2, y2] = proyeksi(obj.position.clone());
        const tinggi = Math.max(60, y2 - y1), lebar = tinggi * 0.7;
        c.strokeStyle = warna; c.lineWidth = 3; c.strokeRect(x1 - lebar / 2, y1 - 8, lebar, tinggi + 16);
        teks(lb, x1 - lebar / 2, y1 - 24, { size: 20, warna, bobot: 800, align: 'left', garis: 5, warnaGaris: 'rgba(0,0,0,.7)' });
      };
      if (s.footage) kotak(darjo, 2.4, 'CAK DARJO', '#ffd166');
      if (s.cahaya && cahaya.visible) kotak(cahaya, 0.8, '??? 🔦', '#ff4d4d');
      if (hantu.visible) kotak(hantu, 2.6, '??? ' + (Math.floor(t * 3) % 2 ? '⚠️' : ''), '#ff4d4d');
      teks(`00:00:${String(dtk % 60).padStart(2, '0')}  ${NASKAH.cctvTanggal || '13/11/2026'}`, W - 40, H - 150, { size: 24, warna: '#fff', bobot: 700, align: 'right', garis: 5, warnaGaris: 'rgba(0,0,0,.6)' });
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3;
      for (const [x, y, dx, dy] of [[30, 100, 1, 1], [W - 30, 100, -1, 1], [30, H - 120, 1, -1], [W - 30, H - 120, -1, -1]]) { c.beginPath(); c.moveTo(x, y + dy * 40); c.lineTo(x, y); c.lineTo(x + dx * 40, y); c.stroke(); }
      c.restore();
    }
    if (s.hujan != null) {            // hujan: langit meredup + garis air jatuh
      const u = (t - s.start) / s.dur, k = Math.min(1, Math.max(0, (u - s.hujan) / 0.06));
      if (k > 0) {
        c.save(); c.scale(SKALA, SKALA);
        c.fillStyle = `rgba(40,60,85,${0.26 * k})`; c.fillRect(0, 0, W, H);
        c.strokeStyle = `rgba(210,225,240,${0.7 * k})`; c.lineWidth = 2; c.beginPath();
        for (let r = 0; r < 160; r++) { const x = (r * 97.3 + t * 120) % (W + 100) - 50, y = (r * 211.7 + t * 1500) % (H + 60) - 30; c.moveTo(x, y); c.lineTo(x - 7, y + 30); }
        c.stroke(); c.restore();
      }
    }
    c.save(); c.scale(SKALA, SKALA);
    if (NASKAH.vinyet || s.vinyet) {   // tepi layar gelap (suasana misteri)
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(5,8,20,${NASKAH.vinyet || 0.55})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    if (s.kilat != null) {             // kilat putih
      const u = t - (s.start + s.dur * s.kilat), a = u < 0 ? 0 : u < 0.12 ? 0.9 : u < 0.3 ? 0.9 * (1 - (u - 0.12) / 0.18) : u > 0.42 && u < 0.5 ? 0.6 : 0;
      if (a > 0) { c.fillStyle = `rgba(235,242,255,${a})`; c.fillRect(0, 0, W, H); }
    }
    if (s.fadeOut) { const a = 1 - (selesai(i) - t) / s.fadeOut; if (a > 0) { c.fillStyle = `rgba(0,0,0,${Math.min(1, a)})`; c.fillRect(0, 0, W, H); } }   // transisi: tenggelam ke gelap
    if (s.fade) { const a = 1 - (t - mulai(i)) / s.fade; if (a > 0) { c.fillStyle = `rgba(0,0,0,${Math.min(1, a)})`; c.fillRect(0, 0, W, H); } }   // transisi: muncul dari gelap
    if (NASKAH.handycam) handycam(t, s, i);
    if (NASKAH.bioskop || s.bioskop) { c.fillStyle = '#000'; c.fillRect(0, 0, W, 96); c.fillRect(0, H - 96, W, 96); }   // garis hitam ala film
    c.restore();
    if (pj) {
      rPojok.render(scPojok, camPojok);
      const masuk = i > 0 && SEG[i - 1].darjo === 'pojok' ? 1 : easeOut((t - mulai(i)) / 0.45);
      c.drawImage(rPojok.domElement, (W - PW + 10 + (1 - masuk) * PW) * SKALA, (H - PH) * SKALA, PW * SKALA, PH * SKALA);
    }
    overlay(t);
    return out.toDataURL('image/jpeg', mutu);
  },
};
window.videoSiap = true;
