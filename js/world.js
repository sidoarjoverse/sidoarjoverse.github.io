// Peta 3D SidoarjoVerse (Three.js): kota low-poly + karakter bulat. Semua model dibuat di kode ini, tanpa aset luar.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { lookFor } from './avatar.js';
import { KAV_W, KAV_D, KAVLING_PERUMAHAN, tataRumahBlok, kendaraanRumah } from './tipe.js';
import { SDA } from './sidoarjo-data.js';

// ---------------------------------------------------------------- material & builder
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const MATS = new Map();
const winMat = new THREE.MeshStandardMaterial({ color: '#c9e2ea', roughness: 0.35 });
const lampMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', roughness: 0.5 });
const waterMat = new THREE.MeshStandardMaterial({ color: '#7fb6c6', roughness: 0.18, transparent: true, opacity: 0.9 });
const tambakMat = new THREE.MeshStandardMaterial({ color: '#86ada3', roughness: 0.25, transparent: true, opacity: 0.92 });

// ---------- tekstur prosedural (dibuat di kanvas, tanpa aset luar) dipetakan memakai posisi dunia (x,z) → tidak melar di kotak besar
function kanvasTekstur(jenis) {
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), r = rng(jenis.length * 97 + 13);
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, N, N);
  const titik = (n, ukur, lo, hi, a = 1) => { for (let i = 0; i < n; i++) { const v = lo + r() * (hi - lo); g.fillStyle = `rgba(${v},${v},${v},${a})`; const x = r() * N, y = r() * N, w = ukur * (0.5 + r()); g.fillRect(x, y, w, w); if (x + w > N) g.fillRect(x - N, y, w, w); if (y + w > N) g.fillRect(x, y - N, w, w); } };
  if (jenis === 'rumput') {
    titik(900, 10, 105, 150, 0.35); titik(5000, 2, 80, 175, 0.9);
    for (let i = 0; i < 2600; i++) { const v = 90 + r() * 90, x = r() * N, y = r() * N, h = 3 + r() * 5; g.strokeStyle = `rgba(${v},${v},${v},0.9)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y - h); g.stroke(); }
  } else if (jenis === 'padi') {
    for (let y = 0; y < N; y += 8) { g.fillStyle = 'rgba(92,92,92,0.55)'; g.fillRect(0, y, N, 3); }
    for (let i = 0; i < 7000; i++) { const v = 100 + r() * 110, x = r() * N, y = Math.floor(r() * 32) * 8 + 3 + r() * 5; g.fillStyle = `rgba(${v},${v},${v},0.95)`; g.fillRect(x, y - 2, 1.4, 3); }
  } else if (jenis === 'tanah') {
    titik(700, 14, 100, 150, 0.35); titik(4000, 2.5, 70, 170, 0.8); titik(160, 4, 60, 90, 0.9);
  } else if (jenis === 'pasir') {
    titik(600, 12, 115, 145, 0.3); titik(6000, 1.5, 95, 165, 0.8);
  } else if (jenis === 'aspal') {
    titik(9000, 1.3, 70, 190, 0.6); titik(80, 18, 105, 125, 0.25);
  } else if (jenis === 'daun') {
    titik(1200, 7, 70, 190, 0.7); titik(3000, 2, 60, 200, 0.8);
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const TEKSTUR = {};
const JENIS_TEKSTUR = {   // warna (kunci material) → [jenis tekstur, skala per satuan, kekuatan]
  '#a3b868': ['rumput', 0.12, 1], '#9fb466': ['rumput', 0.12, 1], '#a2b867': ['rumput', 0.12, 1], '#a7bc6b': ['rumput', 0.12, 1], '#9fb464': ['rumput', 0.12, 1],
  '#8fb35a': ['rumput', 0.14, 1], '#8fb352': ['rumput', 0.12, 1], '#5f7a3a': ['rumput', 0.1, 1], '#a9b56a': ['rumput', 0.1, 1], '~#a3ad74': ['rumput', 0.05, 0.8],
  '#9cc95a': ['padi', 0.25, 1], '#8fbf4f': ['padi', 0.25, 1], '#6fa53a': ['padi', 0.25, 1], '#b8c95a': ['padi', 0.25, 1], '#d6c25a': ['padi', 0.25, 1],
  '#c2a172': ['tanah', 0.15, 1], '#b08a5a': ['tanah', 0.15, 1], '#d7c49c': ['tanah', 0.18, 1], '#b8a77a': ['tanah', 0.15, 1], '#9c8461': ['tanah', 0.18, 1], '#8a6d47': ['tanah', 0.2, 1], '#6f5a3c': ['tanah', 0.15, 1], '#bdb5a6': ['tanah', 0.3, 0.6],
  '#e8d9a8': ['pasir', 0.15, 1], '#6e6b67': ['aspal', 0.35, 1], '#8d8a84': ['aspal', 0.35, 0.8],
};
function pasangTekstur(m, k) {
  const j = JENIS_TEKSTUR[k]; if (!j) return;
  const [jenis, skala, kuat] = j; TEKSTUR[jenis] = TEKSTUR[jenis] || kanvasTekstur(jenis);
  const tex = TEKSTUR[jenis];
  m.onBeforeCompile = sh => {
    sh.uniforms.tTekstur = { value: tex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 wp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n wp = instanceMatrix * wp;\n#endif\n vWPos = (modelMatrix * wp).xyz; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform sampler2D tTekstur;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      { float t1 = texture2D(tTekstur, vWPos.xz * ${skala.toFixed(3)}).r; float t2 = texture2D(tTekstur, vWPos.xz * ${(skala * 0.17).toFixed(4)} + 0.37).r;
        float t3 = texture2D(tTekstur, vWPos.xz * 0.004 + 0.71).r;   // belang besar (petak warna alami)
        float d = clamp((t1 - 0.5) * 2.2 + (t2 - 0.5) * 0.9 + 0.5, 0.0, 1.0);
        float v = mix(1.0, (0.62 + d * 0.76) * (0.86 + t3 * 0.28), ${kuat.toFixed(2)}); diffuseColor.rgb *= v; }`);
  };
  m.customProgramCacheKey = () => 'tekstur-' + jenis + skala + kuat;
}
function mat(k) {
  if (k === 'win') return winMat;
  if (k === 'lamp') return lampMat;
  if (k === 'water') return waterMat;
  if (k === 'tambak') return tambakMat;
  let m = MATS.get(k);
  if (!m) { const datar = k[0] === '~'; m = new THREE.MeshStandardMaterial({ color: datar ? k.slice(1) : k, roughness: 0.92, metalness: 0, flatShading: datar }); pasangTekstur(m, k); MATS.set(k, m); }
  return m;
}

// Voxel Builder: kumpulkan kotak per warna lalu gabung jadi sedikit mesh (ringan di HP).
const MAT_AWAN = new THREE.MeshStandardMaterial({ color: '#fbf8f2', emissive: '#f2ede4', emissiveIntensity: 0.45, roughness: 1, flatShading: true });
// cahaya lembut lampu saat malam: pendar di kepala lampu + lingkaran sinar hangat di tanah (tanpa PointLight, ringan untuk HP)
const TEX_PENDAR = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(0.6, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const MAT_PENDAR = new THREE.SpriteMaterial({ map: TEX_PENDAR, color: '#ffcf7a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, visible: false });
const MAT_SINAR = new THREE.MeshBasicMaterial({ map: TEX_PENDAR, color: '#ffb85c', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, visible: false, polygonOffset: true, polygonOffsetFactor: -2 });
const GEO_SINAR = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const BOLA_LP = new THREE.IcosahedronGeometry(0.5, 1); // bola low-poly bersegi (pohon, semak, awan)
class VB {
  constructor() { this.parts = new Map(); this.lampu = []; }
  _add(c, m, geo) { let l = this.parts.get(c); if (!l) { l = []; this.parts.set(c, l); } l.push([m, geo]); return this; }
  // x,z = pusat, y = dasar kotak
  box(x, y, z, w, h, d, c) {
    if (c === 'lamp') this.lampu.push([x, y + h / 2, z]);
    return this._add(c, new THREE.Matrix4().makeScale(w, h, d).setPosition(x, y + h / 2, z), UNIT);
  }
  // bola low-poly: x,z = pusat, y = dasar
  bola(x, y, z, w, h, d, c) {
    return this._add(c, new THREE.Matrix4().makeScale(w, h, d).setPosition(x, y + h / 2, z), BOLA_LP);
  }
  build({ shadow = true } = {}) {
    const g = new THREE.Group();
    for (const [c, list] of this.parts) {
      const campur = list.some(([, geo]) => geo !== UNIT);
      const geos = list.map(([m, geo]) => { const x = geo.clone().applyMatrix4(m); return campur && x.index ? x.toNonIndexed() : x; });
      const geo = mergeGeometries(geos, false);
      geos.forEach(x => x.dispose());
      const mesh = new THREE.Mesh(geo, mat(c));
      mesh.castShadow = shadow && c !== 'water' && c !== 'tambak';
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    for (const [x, y, z] of this.lampu) {
      const p = new THREE.Sprite(MAT_PENDAR); p.position.set(x, y, z); p.scale.setScalar(2.8); g.add(p);
      const r = Math.min(6.5, 2.6 + y * 1.4), k = new THREE.Mesh(GEO_SINAR, MAT_SINAR); k.position.set(x, 0.07, z); k.scale.set(r, 1, r); k.renderOrder = 2; g.add(k);
    }
    return g;
  }
}

export function rng(seed) {
  let a = typeof seed === 'number' ? seed : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function canvasTex(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Label teks melayang (nama warga, status bangunan)
// gelembung chat (Mode Ramai): kotak putih + ekor kecil
function gelembungSprite(text) {
  const dpr = 3, fs = 26, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  ctx.font = `700 ${fs}px system-ui, sans-serif, "Noto Color Emoji"`;
  const W = Math.ceil(ctx.measureText(text).width) + 34, H = fs + 22, T = 12;
  cv.width = W * dpr; cv.height = (H + T) * dpr; ctx.scale(dpr, dpr);
  ctx.font = `700 ${fs}px system-ui, sans-serif, "Noto Color Emoji"`;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0f4c5c'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(1.5, 1.5, W - 3, H - 3, 16); ctx.moveTo(W / 2 - 9, H - 2); ctx.lineTo(W / 2, H + T - 2); ctx.lineTo(W / 2 + 9, H - 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 8, H - 5, 16, 4);
  ctx.fillStyle = '#16324f'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(text, W / 2, H / 2 + 1);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(cv), depthWrite: false, depthTest: false }));
  sp.center.set(0.5, 0); sp.scale.set(0.7 * W / H, 0.7 * (H + T) / H, 1); sp.renderOrder = 12;
  return sp;
}
function textSprite(text, { bg = 'rgba(255,255,255,.94)', fg = '#123', size = 0.62, border = null } = {}) {
  const dpr = 3, fs = 26;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  const tw = Math.ceil(ctx.measureText(text).width);
  const W = tw + 28, H = fs + 18;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(1, 1, W - 2, H - 2, 10); ctx.fill();
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2.5; ctx.stroke(); }
  ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, H / 2 + 1);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(cv), depthWrite: false }));
  sp.center.set(0.5, 0);
  sp.scale.set(size * W / H, size, 1);
  sp.renderOrder = 10;
  return sp;
}

// Papan nama datar (gapura, pasar, dll)
function signMesh(text, w, h, bg = '#0f4c5c', fg = '#ffd166') {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * h / w);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = fg; ctx.lineWidth = 8; ctx.strokeRect(10, 10, cv.width - 20, cv.height - 20);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = cv.height * 0.55;
  ctx.font = `900 ${fs}px system-ui, sans-serif`;
  while (ctx.measureText(text).width > cv.width - 50 && fs > 10) { fs -= 2; ctx.font = `900 ${fs}px system-ui, sans-serif`; }
  ctx.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: canvasTex(cv) }));
  return m;
}

// ---------------------------------------------------------------- tata kota
const LINES = [-16, 0, 16];   // posisi jalan (x untuk jalan vertikal, z untuk horizontal)
const EDGE = 28;              // ujung jalan
const RIVER = [21, 25];       // sungai (z dari..sampai)
const ROAD_W = 3;

// Graf jalan untuk karakter berjalan
function buildGraph() {
  const nodes = new Map();
  const key = (x, z) => x + ',' + z;
  const add = (x, z) => { const k = key(x, z); if (!nodes.has(k)) nodes.set(k, { k, x, z, n: new Set() }); return nodes.get(k); };
  const link = (a, b) => { a.n.add(b.k); b.n.add(a.k); };
  const xs = [-26, -16, 0, 16, 26];
  for (const z of LINES) { let prev = null; for (const x of xs) { const n = add(x, z); if (prev) link(prev, n); prev = n; } }
  for (const x of LINES) {
    const zs = x === 0 ? [-26, -16, 0, 16, 28] : [-26, -16, 0, 16];
    let prev = null; for (const z of zs) { const n = add(x, z); if (prev) link(prev, n); prev = n; }
  }
  grafKawasan(add, link);
  return nodes;
}

function bfs(nodes, from, to) {
  if (from === to) return [];
  const prev = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const c = q.shift();
    if (c === to) break;
    for (const nb of nodes.get(c).n) if (!prev.has(nb)) { prev.set(nb, c); q.push(nb); }
  }
  if (!prev.has(to)) return [];
  const path = [];
  for (let c = to; c !== from; c = prev.get(c)) path.unshift(c);
  return path;
}

// ---------------------------------------------------------------- model bangunan
const PALET_RUMAH = ['#f6e7c1', '#cde7d8', '#f9d5c5', '#d7e3fc', '#fbe0a6', '#e8d6f0', '#ffffff'];

function pohon(vb, x, z, r, tipe) {
  if (tipe === 'kelapa') {
    const h = 3.2 + r() * 1.5;
    for (let i = 0; i < h; i += 0.6) vb.box(x + Math.sin(i) * 0.12, i, z, 0.28, 0.6, 0.28, '#8a6e4f');
    vb.box(x, h, z, 2.6, 0.18, 0.5, '~#6f9447').box(x, h, z, 0.5, 0.18, 2.6, '~#6f9447').bola(x, h + 0.05, z, 0.8, 0.45, 0.8, '~#7da152');
    vb.box(x + 0.25, h - 0.3, z, 0.25, 0.3, 0.25, '#6b4a2a');
    return;
  }
  const h = 1 + r() * 0.8, s = 1.6 + r() * 0.9;
  const hijau = ['~#7a9a4a', '~#86a552', '~#6f8f45', '~#90ab5a'][Math.floor(r() * 4)];
  vb.box(x, 0, z, 0.3, h + 0.3, 0.3, '#7d5a3c');
  vb.bola(x, h - 0.1, z, s, s * 0.95, s, hijau);
  vb.bola(x + s * 0.18, h + s * 0.45, z - s * 0.1, s * 0.7, s * 0.65, s * 0.7, hijau);
}

function rumah(vb, x, z, c, r, rot = 0) {
  const w = 2.6, d = 2.4, h = 1.9;
  vb.box(x, 0, z, w + 0.3, 0.2, d + 0.3, '#bdb5a6');
  vb.box(x, 0.2, z, w, h, d, c);
  // atap genteng bertingkat
  const atap = r() < 0.5 ? '#b5523b' : '#8e3b2e';
  vb.box(x, 0.2 + h, z, w + 0.5, 0.35, d + 0.5, atap);
  vb.box(x, 0.55 + h, z, w - 0.2, 0.35, d - 0.4, atap);
  vb.box(x, 0.9 + h, z, w - 0.9, 0.35, d - 1.2, atap);
  // pintu & jendela (depan = +z)
  vb.box(x - 0.5, 0.2, z + d / 2 + 0.01, 0.6, 1.15, 0.06, '#6d4527');
  vb.box(x + 0.55, 0.9, z + d / 2 + 0.01, 0.7, 0.55, 0.06, 'win');
  vb.box(x + w / 2 + 0.01, 0.9, z, 0.06, 0.55, 0.7, 'win');
  vb.box(x - w / 2 - 0.01, 0.9, z, 0.06, 0.55, 0.7, 'win');
}

function pagarKeliling(vb, w, d, warna = '#e9e2d0') {
  const step = 1;
  for (let x = -w / 2; x <= w / 2 + 0.01; x += step) { vb.box(x, 0, -d / 2, 0.15, 0.7, 0.15, warna); vb.box(x, 0, d / 2, 0.15, 0.7, 0.15, warna); }
  for (let z = -d / 2; z <= d / 2 + 0.01; z += step) { vb.box(-w / 2, 0, z, 0.15, 0.7, 0.15, warna); vb.box(w / 2, 0, z, 0.15, 0.7, 0.15, warna); }
  vb.box(0, 0.45, -d / 2, w, 0.1, 0.08, warna).box(0, 0.45, d / 2, w, 0.1, 0.08, warna);
  vb.box(-w / 2, 0.45, 0, 0.08, 0.1, d, warna).box(w / 2, 0.45, 0, 0.08, 0.1, d, warna);
}

// ---------------------------------------------------------------- kawasan baru (perluasan kota)
// Barat: Kawasan Perumahan (padang luas, kavling 40 rumah per blok). Timur: Pusat Kota (lahan monumen & mal, perempatan bangjo).
// peta = gabungan 2 persegi: kota + pusat kota (A) dan kawasan perumahan ke utara (B)
// SKALA: 1 satuan peta = 2 meter. Kota (A) + kawasan perumahan (B) di tengah daerah luas (C: sawah, tambak, pantai, lahan rencana)
// ---------------------------------------------------------------- PETA SIDOARJO ASLI (data OpenStreetMap, 1 satuan = 20 m, pusat = alun-alun)
// Kota lama (alun-alun, Balai Kota) & pusat kota tetap di tengah; perumahan, sungai, jalan, rel, bandara mengikuti letak aslinya.
const PETA_KOTA = [{ x0: -32, x1: 32, z0: -32, z1: 34 }, { x0: 32, x1: 140, z0: -86, z1: 19 }];   // kota lama + pusat kota
const POLY = SDA.batas;
export const BATAS = (() => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of POLY) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x0, x1, z0, z1 }; })();
export const DAERAH = BATAS;
const diPoly = (x, z) => { let d = false; for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) { const [xi, zi] = POLY[i], [xj, zj] = POLY[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; };
const diKota = (x, z, m = 0) => PETA_KOTA.some(p => x > p.x0 + m && x < p.x1 - m && z > p.z0 + m && z < p.z1 - m);
// garis pantai: titik paling timur batas di tiap ketinggian z (sebelah timurnya laut)
const PANTAI = (() => { const t = new Map(); for (let z = Math.floor(BATAS.z0); z <= BATAS.z1; z += 4) { let mx = -1e9; for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) { const [xi, zi] = POLY[i], [xj, zj] = POLY[j]; if ((zi > z) !== (zj > z)) mx = Math.max(mx, (xj - xi) * (z - zi) / (zj - zi) + xi); } t.set(z, mx); } let akhir = null; for (const [z, v] of t) { if (v > -1e8) akhir = v; else if (akhir !== null) t.set(z, akhir); } akhir = null; for (const z of [...t.keys()].reverse()) { const v = t.get(z); if (v > -1e8) akhir = v; else if (akhir !== null) t.set(z, akhir); } return z => (z < BATAS.z0 || z > BATAS.z1) ? BATAS.x1 + 40 : (t.get(Math.max(Math.floor(BATAS.z0), Math.min(BATAS.z1, Math.round(z / 4) * 4))) ?? BATAS.x1 + 40); })();
const diLaut = (x, z) => !diPoly(x, z) && x > PANTAI(z) - 1 && PANTAI(z) > -1e8 || (x > BATAS.x1 - 2);
export const diPeta = (x, z, m = 0) => diKota(x, z, m) || (diPoly(x, z) && diPoly(x + m, z) && diPoly(x - m, z) && diPoly(x, z + m) && diPoly(x, z - m));

// ---------- raster penanda (sel 4×4 satuan): 1 jalan, 2 sungai, 4 rel, 8 kavling/lahan  → cepat untuk mengisi sawah & tabrakan
const RS = 4, RX0 = BATAS.x0 - 40, RZ0 = BATAS.z0 - 40, RW = Math.ceil((BATAS.x1 - BATAS.x0 + 80) / RS), RH = Math.ceil((BATAS.z1 - BATAS.z0 + 80) / RS);
const RASTER = new Uint8Array(RW * RH);
const rIdx = (x, z) => { const i = Math.floor((x - RX0) / RS), k = Math.floor((z - RZ0) / RS); return i < 0 || k < 0 || i >= RW || k >= RH ? -1 : k * RW + i; };
const tanda = (x, z, b) => { const i = rIdx(x, z); if (i >= 0) RASTER[i] |= b; };
const kena = (x, z, b) => { const i = rIdx(x, z); return i >= 0 && (RASTER[i] & b); };
function tandaGaris(p, lebar, b) { for (let k = 0; k + 1 < p.length; k++) { const [ax, az] = p[k], [bx, bz] = p[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2); for (let s = 0; s <= n; s++) { const x = ax + (bx - ax) * s / n, z = az + (bz - az) * s / n; for (let u = -lebar / 2; u <= lebar / 2; u += 2) for (let v = -lebar / 2; v <= lebar / 2; v += 2) tanda(x + u, z + v, b); } } }
// kotak (pusat x,z, ukuran w×d) bebas dari penanda b?
const kotakBebas = (x, z, w, d, b) => { for (let u = -w / 2; u <= w / 2 + 0.01; u += RS) for (let v = -d / 2; v <= d / 2 + 0.01; v += RS) if (kena(x + u, z + v, b)) return false; return true; };
// titik bebas untuk pohon/gubuk: bukan jalan, sungai, rel, kavling, kota
const titikBebas = (x, z) => !kena(x, z, 15) && !kena(x + 2, z, 3) && !kena(x - 2, z, 3) && !kena(x, z + 2, 3) && !kena(x, z - 2, 3) && !diKota(x, z, -4) && diPoly(x, z);
const tandaKotak = (x, z, w, d, b) => { for (let u = -w / 2; u <= w / 2; u += 2) for (let v = -d / 2; v <= d / 2; v += 2) tanda(x + u, z + v, b); };

// jalan asli (di luar kota) + penyambung dari ujung jalan kota ke jaringan asli
const LEBAR_JALAN = { tol: 7, raya: 5, kabupaten: 3.6, akses: 3 };
const potongKota = p => { const out = []; let cur = []; for (const q of p) { if (diKota(q[0], q[1], -6)) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(q); } if (cur.length > 1) out.push(cur); return out; };
export const JALAN_ASLI = SDA.jalan.flatMap(j => potongKota(j.p).map(p => ({ ...j, p })));
function titikTerdekat(x, z, daftar) { let best = null, bd = 1e18; for (const j of daftar) for (let k = 0; k + 1 < j.p.length; k++) { const [ax, az] = j.p[k], [bx, bz] = j.p[k + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; best = [px, pz]; } } return best; }
for (const p of SDA.penyambung || []) JALAN_ASLI.push({ k: 'raya', n: 'penyambung', p });
for (const p of SDA.akses || []) JALAN_ASLI.push({ k: 'akses', n: 'akses', p });
for (const j of JALAN_ASLI) tandaGaris(j.p, LEBAR_JALAN[j.k] + 2, 1);
// sungai asli + kali kota disambung ke sungai terdekat
export const SUNGAI = SDA.sungai.flatMap(s => potongKota(s.p).map(p => ({ ...s, p })));
{
  const besar = SUNGAI.filter(s => s.lebar >= 5);
  for (const [x, arah] of [[-32, -1], [32, 1]]) {
    const t = titikTerdekat(x + arah * 30, 23, besar);
    if (t) { const mx = (x + t[0]) / 2, mz = (23 + t[1]) / 2 + 10 * arah; SUNGAI.push({ n: 'Kali Pucang', lebar: 4, p: [[x, 23], [x + arah * 12, 23], [mx, mz], t] }); }
  }
}
for (const s of SUNGAI) tandaGaris(s.p, s.lebar + 9, 2);
export const REL = SDA.rel.flatMap(p => potongKota(p));
for (const p of REL) tandaGaris(p, 22, 4);
for (const K of KAVLING_PERUMAHAN) tandaKotak(K.x, K.z, KAV_W + 6, KAV_D + 8, 8);
export const LAHAN_RENCANA = SDA.lahan;
for (const L of LAHAN_RENCANA) tandaKotak(L.x, L.z, L.w + 4, L.d + 4, 8);
const BANDARA = SDA.bandara;
const diBandara = (x, z) => { if (!BANDARA) return false; const P = BANDARA.p; let d = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; };

const PEREMPATAN = [[62, 0], [100, 0], [62, -42], [100, -42]];   // perempatan dengan bangjo (pusat kota)
const JALAN_BARU = [   // jalan lurus pusat kota [x1, z1, x2, z2, garis tengah?, lampu tiap … m]
  [28, 0, 140, 0, true, 12], [62, -82, 62, 19, true, 12], [100, -82, 100, 19, true, 12], [34, -42, 136, -42, true, 12],
];
const SIMPANG = [];
for (const h of JALAN_BARU.filter(j => j[1] === j[3])) for (const v of JALAN_BARU.filter(j => j[0] === j[2])) {
  const x = v[0], z = h[1];
  if (x >= Math.min(h[0], h[2]) - 2 && x <= Math.max(h[0], h[2]) + 2 && z >= Math.min(v[1], v[3]) - 2 && z <= Math.max(v[1], v[3]) + 2) SIMPANG.push([x, z]);
}
export const LAHAN_KOTA = [
  { id: 'lahan-monumen', nama: 'LAHAN MONUMEN', x: 45, z: -21, w: 22, d: 34 },
  { id: 'lahan-mal-1', nama: 'LAHAN MAL', x: 81, z: -21, w: 32, d: 34 },
  { id: 'lahan-mal-2', nama: 'LAHAN MAL', x: 81, z: -63, w: 32, d: 36 },
  { id: 'lahan-mal-3', nama: 'LAHAN MAL', x: 119, z: -21, w: 30, d: 34 },
  { id: 'lahan-gedung-1', nama: 'LAHAN GEDUNG', x: 119, z: -63, w: 30, d: 36 },
  { id: 'lahan-gedung-2', nama: 'LAHAN GEDUNG', x: 45, z: -63, w: 22, d: 36 },
];
// data ringkas untuk peta 2D (menu Peta di website)
export function dataPeta(kota) {
  const pr = (kota && kota.perumahan) || [];
  return {
    batas: POLY, bbox: BATAS, kota: PETA_KOTA, pantai: PANTAI,
    jalan: [...JALAN_ASLI.map(j => ({ k: j.k, p: j.p })), ...JALAN_BARU.map(j => ({ k: 'kota', p: [[j[0], j[1]], [j[2], j[3]]] })), ...LINES.map(z => ({ k: 'kota', p: [[-EDGE, z], [EDGE, z]] })), ...LINES.map(x => ({ k: 'kota', p: [[x, -EDGE], [x, x === 0 ? 31 : 16]] }))],
    sungai: SUNGAI, rel: REL, bandara: BANDARA, kecamatan: SDA.kecamatan,
    kavling: KAVLING_PERUMAHAN.map((K, i) => { const p = pr.find(q => q.kavling === i); return { x: K.x, z: K.z, w: KAV_W, d: KAV_D, nama: p ? p.nama : K.n, blok: p ? p.blok : null, ada: !!p }; }),
    lahan: [...LAHAN_RENCANA, ...LAHAN_KOTA.map(L => ({ ...L, sub: '' }))],
    jembatan: JEMBATAN,
  };
}
export function grafKawasan(add, link) {
  const rantai = pts => { let p = null; for (const [x, z] of pts) { const n = add(x, z); if (p) link(p, n); p = n; } };
  rantai([[26, 0], [45, 0], [62, 0], [81, 0], [100, 0], [119, 0], [136, 0]]);
  rantai([[62, 0], [62, -42], [62, -80]]); rantai([[100, 0], [100, -42], [100, -80]]);
  rantai([[36, -42], [62, -42], [81, -42], [100, -42], [134, -42]]);
}
function dalamJalanBaru(x, z, m = 0) {
  for (const [x1, z1, x2, z2] of JALAN_BARU) {
    const lw = ROAD_W / 2 + m;
    if (z1 === z2 && Math.abs(z - z1) < lw && x > Math.min(x1, x2) - m && x < Math.max(x1, x2) + m) return true;
    if (x1 === x2 && Math.abs(x - x1) < lw && z > Math.min(z1, z2) - m && z < Math.max(z1, z2) + m) return true;
  }
  return false;
}
// garis dihaluskan (kurva Catmull-Rom) supaya belokan sungai & jalan melengkung, bukan patah
function haluskan(p) {
  if (p.length < 3) { const out = []; for (let k = 0; k + 1 < p.length; k++) { const [ax, az] = p[k], [bx, bz] = p[k + 1], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 6)); for (let s = 0; s < m; s++) out.push([ax + (bx - ax) * s / m, az + (bz - az) * s / m]); } out.push(p[p.length - 1]); return out; }
  const kv = new THREE.CatmullRomCurve3(p.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  let L = 0; for (let k = 0; k + 1 < p.length; k++) L += Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]);
  return kv.getSpacedPoints(Math.max(2, Math.ceil(L / 4))).map(v => [v.x, v.z]);
}
// pita mengikuti garis (jalan, sungai): lebar tetap, y tetap
function pita(p, lebar, y) {
  const pos = [], idx = []; let n = 0;
  const titik = haluskan(p);
  for (let k = 0; k < titik.length; k++) {
    const a = titik[Math.max(0, k - 1)], b = titik[Math.min(titik.length - 1, k + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, [x, z] = titik[k];
    pos.push(x + nx * lebar / 2, y, z + nz * lebar / 2, x - nx * lebar / 2, y, z - nz * lebar / 2);
    if (n) idx.push(2 * n - 2, 2 * n, 2 * n - 1, 2 * n - 1, 2 * n, 2 * n + 1); n++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const gabungPita = (daftar, m) => { if (!daftar.length) return new THREE.Group(); const g = mergeGeometries(daftar); daftar.forEach(x => x.dispose()); const me = new THREE.Mesh(g, m); me.receiveShadow = true; return me; };
const MAT_SUNGAI = new THREE.MeshStandardMaterial({ color: '#4f8f9c', roughness: 0.12, metalness: 0.15 });
const MAT_LAUT = new THREE.MeshStandardMaterial({ color: '#4e8fa8', roughness: 0.15, metalness: 0.1 });
// titik-titik jembatan: jalan (bukan akses) memotong sungai
const JEMBATAN = (() => {
  const out = [];
  const potong = (a, b, c, d) => { const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]); if (Math.abs(r) < 1e-9) return null; const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r, u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] : null; };
  const urut = [...SUNGAI].sort((p, q) => q.lebar - p.lebar);   // sungai besar didahulukan (jembatan besar menang)
  for (const s of urut) for (const j of JALAN_ASLI) { for (let a = 0; a + 1 < j.p.length; a++) for (let b = 0; b + 1 < s.p.length; b++) {
    const t = potong(j.p[a], j.p[a + 1], s.p[b], s.p[b + 1]); if (!t) continue;
    const ry = Math.atan2(j.p[a + 1][0] - j.p[a][0], j.p[a + 1][1] - j.p[a][1]);
    if (!out.some(o => Math.hypot(o.x - t[0], o.z - t[1]) < (s.lebar >= 14 ? 8 : 14))) out.push({ x: t[0], z: t[1], ry, lebar: s.lebar, jalan: j.k, besar: s.lebar >= 14 && j.k !== 'kabupaten' });
  } }
  return out;
})();
// jembatan besar berlengkung (tied-arch)
function jembatanBesar(statik, x, z, panjang, ry = 0, lebarJalan = 7.5) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  const L = panjang / 2, H = 3.2, LEBAR = lebarJalan;
  const dek = new VB();
  const yDek = u => H * (1 - u * u) + 0.15;
  for (let i = -20; i < 20; i++) {
    const u0 = i / 20, u1 = (i + 1) / 20, y0 = yDek(u0), y1 = yDek(u1), zz = (u0 + u1) / 2 * L, ln = (u1 - u0) * L;
    dek.box(0, (y0 + y1) / 2 - 0.35, zz, LEBAR, 0.5, ln + 0.05, '#c9c3b6');
    dek.box(0, (y0 + y1) / 2 + 0.15, zz, LEBAR - 1.4, 0.02, ln + 0.05, '#6e6b67');
    for (const s of [-1, 1]) dek.box(s * (LEBAR / 2 - 0.35), (y0 + y1) / 2 + 0.15, zz, 0.4, 0.25, ln + 0.05, '#e9e2d0');
    if (i % 2 === 0) dek.box(0, (y0 + y1) / 2 + 0.18, zz, 0.15, 0.01, ln * 0.5, '#f4f4f4');
  }
  for (const u of [-0.55, 0, 0.55]) dek.box(0, -1.2, u * L, 5, yDek(u) + 0.6, 2.6, '#bdb5a6');
  for (const s of [-1, 1]) dek.box(0, -0.2, s * (L + 3), LEBAR + 2, 0.7, 6, '#bdb5a6');
  g.add(dek.build());
  const merah = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.45, metalness: 0.35 });
  const putih = new THREE.MeshStandardMaterial({ color: '#f1f1f1', roughness: 0.5, metalness: 0.2 });
  const tinggi = Math.min(16, 6 + panjang * 0.18);
  for (const s of [-1, 1]) {
    const xa = s * (LEBAR / 2 - 0.1);
    const kurva = new THREE.CatmullRomCurve3([...Array(21)].map((_, k) => { const u = k / 10 - 1; return new THREE.Vector3(xa - s * 0.9 * (1 - u * u), yDek(u) + 0.3 + tinggi * (1 - u * u), u * L * 0.97); }));
    const busur = new THREE.Mesh(new THREE.TubeGeometry(kurva, 80, 0.45, 8), merah); busur.castShadow = true; g.add(busur);
    for (let k = -8; k <= 8; k++) {
      const u = k / 9, p = kurva.getPoint((u + 1) / 2), yb = yDek(u) + 0.3, tt = p.y - yb;
      const kb = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, tt, 5), putih); kb.position.set(p.x, yb + tt / 2, p.z); g.add(kb);
    }
  }
  for (let k = -4; k <= 4; k++) { const u = k / 5, y = yDek(u) + 0.3 + tinggi * (1 - u * u) - 0.4; const b = new THREE.Mesh(new THREE.BoxGeometry(LEBAR - 2.2, 0.35, 0.35), merah); b.position.set(0, y, u * L * 0.97); g.add(b); }
  statik.add(g);
}
// jembatan kecil (beton datar berpagar) untuk jalan biasa di atas sungai kecil
function jembatanKecil(vb, x, z, ry, panjang, lebar) {
  const B = (lx, y, lz, w, h, d, c) => { const cs = Math.cos(ry), sn = Math.sin(ry); const wx = x + lx * cs + lz * sn, wz = z - lx * sn + lz * cs; const q = Math.abs(Math.round(sn)) === 1; vb.box(wx, y, wz, q ? d : w, h, q ? w : d, c); };
  B(0, 0.1, 0, lebar + 1, 0.35, panjang, '#c9c3b6'); B(0, 0.45, 0, lebar - 0.6, 0.02, panjang, '#6e6b67');
  for (const s of [-1, 1]) { B(s * (lebar / 2 + 0.3), 0.45, 0, 0.25, 0.7, panjang, '#e9e2d0'); }
}

// tanah daerah + laut + jalan pusat kota + bangjo + lahan kota + kavling perumahan
function bangunKawasan(statik, kota, footprints, r) {
  // tanah Sidoarjo (bentuk batas asli) dengan lubang di kota lama (kota lama punya petak tanah & kali sendiri)
  const shp = new THREE.Shape(POLY.map(([x, z]) => new THREE.Vector2(x, -z)));
  const h1 = new THREE.Path(); h1.moveTo(-32, 32); h1.lineTo(32, 32); h1.lineTo(32, -34); h1.lineTo(-32, -34); h1.closePath(); shp.holes.push(h1);
  const geoT = new THREE.ShapeGeometry(shp, 2); geoT.rotateX(-Math.PI / 2);   // (x, -z) → (x, 0, z), menghadap ke atas
  const tanahM = new THREE.Mesh(geoT, mat('#8fb352')); tanahM.position.y = -0.03; tanahM.receiveShadow = true;
  statik.add(tanahM);
  // pusat kota: tanah rata (di atas tanah daerah) + kali kota lurus
  const g = new VB();
  g.box(86, -0.62, (-86 + 19) / 2, 108, 0.6, 105, '#a3b868');
  const gt = g.build({ shadow: false }); gt.children.forEach(m => { m.castShadow = false; }); statik.add(gt);
  // laut timur: bentuk dari garis pantai
  const laut = new THREE.Shape(); const zA = BATAS.z0 - 400, zB = BATAS.z1 + 400;
  laut.moveTo(PANTAI(BATAS.z0) + 1, -zA);
  for (let z = BATAS.z0; z <= BATAS.z1; z += 8) laut.lineTo(PANTAI(z) + 1, -z);
  laut.lineTo(PANTAI(BATAS.z1) + 1, -zB); laut.lineTo(BATAS.x1 + 3000, -zB); laut.lineTo(BATAS.x1 + 3000, -zA); laut.closePath();
  const geoL = new THREE.ShapeGeometry(laut, 1); geoL.rotateX(-Math.PI / 2);
  const mL = new THREE.Mesh(geoL, MAT_LAUT); mL.position.y = -0.25; statik.add(mL);
  // pantai berpasir (pita sepanjang garis pantai)
  const pp = []; for (let z = BATAS.z0; z <= BATAS.z1; z += 8) pp.push([PANTAI(z) - 3, z]);
  statik.add(gabungPita([pita(pp, 10, -0.02)], mat('#e8d9a8')));

  // jalan lurus pusat kota (bermarka, trotoar, lampu) + zebra cross + bangjo
  const j = new VB();
  for (const [ax, az, bx, bz, garis, tiap] of JALAN_BARU) {
    const hor = az === bz, len = Math.abs(hor ? bx - ax : bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    j.box(cx, 0, cz, hor ? len : ROAD_W, 0.06, hor ? ROAD_W : len, '#6e6b67');
    const lo = hor ? Math.min(ax, bx) : Math.min(az, bz), hi = hor ? Math.max(ax, bx) : Math.max(az, bz);
    const potong = SIMPANG.filter(([px, pz]) => hor ? pz === az && px > lo - 2 && px < hi + 2 : px === ax && pz > lo - 2 && pz < hi + 2).map(([px, pz]) => [hor ? px : pz, ROAD_W / 2 + 0.5]);
    if (hor && az === 0) potong.push([28, ROAD_W / 2 + 0.5]);
    const titik = [lo, ...potong.sort((p, q) => p[0] - q[0]).flatMap(([c, w]) => [c - w, c + w]), hi];
    for (let k = 0; k + 1 < titik.length; k += 2) {
      const u0 = Math.max(lo, titik[k]), u1 = Math.min(hi, titik[k + 1]); if (u1 - u0 < 0.3) continue;
      const m = (u0 + u1) / 2;
      for (const s of [-1, 1]) j.box(hor ? m : cx + s * (ROAD_W / 2 + 0.25), 0, hor ? cz + s * (ROAD_W / 2 + 0.25) : m, hor ? u1 - u0 : 0.5, 0.12, hor ? 0.5 : u1 - u0, '#d8d0bf');
    }
    const dekatSimpang = (x, z) => SIMPANG.some(([px, pz]) => Math.abs(px - x) < 4.5 && Math.abs(pz - z) < 4.5) || (Math.abs(x) < 30 && Math.abs(z) < 30);
    for (let t = 1; t < len; t += 2.2) { const x = hor ? Math.min(ax, bx) + t : ax, z = hor ? az : Math.min(az, bz) + t; if (garis && !dekatSimpang(x, z)) j.box(x, 0.061, z, hor ? 1.1 : 0.14, 0.01, hor ? 0.14 : 1.1, '#f1f1f1'); }
    for (let t = 6; t < len; t += tiap || 12) { const x = hor ? Math.min(ax, bx) + t : ax + ROAD_W / 2 + 0.6, z = hor ? az - ROAD_W / 2 - 0.6 : Math.min(az, bz) + t; if (dekatSimpang(x, z) || (Math.abs(x) < 33 && Math.abs(z) < 33)) continue; j.box(x, 0, z, 0.15, 2.8, 0.15, '#3a3a3a').box(x, 2.65, z, 0.4, 0.18, 0.4, 'lamp'); }
  }
  for (const [px, pz] of PEREMPATAN) {
    j.box(px, 0.005, pz, ROAD_W + 0.4, 0.062, ROAD_W + 0.4, '#6e6b67');
    for (const s of [-1, 1]) for (let k = -1; k <= 1; k += 0.5) { if (dalamJalanBaru(px + s * 2.6, pz)) j.box(px + s * 2.6, 0.062, pz + k, 1.0, 0.01, 0.28, '#f4f4f4'); if (dalamJalanBaru(px, pz + s * 2.6)) j.box(px + k, 0.062, pz + s * 2.6, 0.28, 0.01, 1.0, '#f4f4f4'); }
  }
  statik.add(j.build());
  for (const [px, pz] of PEREMPATAN) for (const [sx, sz, arah] of [[1, 1, 'z'], [-1, -1, 'z'], [1, -1, 'x'], [-1, 1, 'x']]) {
    const x = px + sx * (ROAD_W / 2 + 0.7), z = pz + sz * (ROAD_W / 2 + 0.7);
    if (!dalamJalanBaru(arah === 'z' ? px : x + sx * 1.5, arah === 'z' ? z + sz * 1.5 : pz)) continue;
    const tiang = new THREE.Mesh(UNIT, mat('#2d3436')); tiang.scale.set(0.16, 3.2, 0.16); tiang.position.set(x, 1.6, z); tiang.castShadow = true; statik.add(tiang);
    const kepala = new THREE.Group(); kepala.position.set(x, 3.0, z); kepala.rotation.y = arah === 'z' ? (sz > 0 ? 0 : Math.PI) : (sx > 0 ? Math.PI / 2 : -Math.PI / 2);
    const kotak = new THREE.Mesh(UNIT, mat('#1e2326')); kotak.scale.set(0.42, 1.2, 0.3); kepala.add(kotak);
    ['m', 'k', 'h'].forEach((w, i) => { const l = new THREE.Mesh(GEO_BANGJO, MAT_BANGJO[arah][w]); l.position.set(0, 0.36 - i * 0.36, 0.16); kepala.add(l); });
    statik.add(kepala);
  }
  // lahan kosong pusat kota
  const lh = new VB();
  for (const L of LAHAN_KOTA) {
    if (footprints.some(f => Math.abs(f.x - L.x) < L.w / 2 && Math.abs(f.z - L.z) < L.d / 2)) continue;
    lh.box(L.x, 0, L.z, L.w - 1, 0.08, L.d - 1, '#c2a172');
    for (let i = 0; i < 10; i++) lh.box(L.x + (r() - 0.5) * (L.w - 4), 0.08, L.z + (r() - 0.5) * (L.d - 4), 0.6 + r(), 0.25, 0.6 + r(), '#9a7548');
    for (let x = -L.w / 2 + 0.5; x <= L.w / 2 - 0.5; x += 1.5) for (const s of [-1, 1]) lh.box(L.x + x, 0, L.z + s * (L.d / 2 - 0.5), 0.14, 0.8, 0.14, '#d9c7a3');
    for (let z = -L.d / 2 + 0.5; z <= L.d / 2 - 0.5; z += 1.5) for (const s of [-1, 1]) lh.box(L.x + s * (L.w / 2 - 0.5), 0, L.z + z, 0.14, 0.8, 0.14, '#d9c7a3');
    lh.box(L.x - 2, 0, L.z + L.d / 2 - 1.2, 0.2, 2.6, 0.2, '#6b4a2a').box(L.x + 2, 0, L.z + L.d / 2 - 1.2, 0.2, 2.6, 0.2, '#6b4a2a');
    const sg = signMesh(L.nama, 4.6, 1.0, '#f4ecd8', '#5c4033'); sg.position.set(L.x, 2.4, L.z + L.d / 2 - 1.08); statik.add(sg);
    const sg2 = signMesh('komen like terbanyak 👇', 4.6, 0.6, '#ffd166', '#3d2a00'); sg2.position.set(L.x, 1.6, L.z + L.d / 2 - 1.08); statik.add(sg2);
  }
  statik.add(lh.build());

  // kavling perumahan (letak asli)
  const pr = new VB(), daftar = (kota && kota.perumahan) || [];
  KAVLING_PERUMAHAN.forEach((K, i) => {
    const p = daftar.find(d => d.kavling === i);
    const depan = K.z + KAV_D / 2;
    pr.box(K.x, -0.02, K.z, KAV_W + 2, 0.06, KAV_D + 2, '#a3b868');   // halaman kavling rata
    if (!p) {
      for (let x = -KAV_W / 2; x <= KAV_W / 2; x += 2) for (const s of [-1, 1]) pr.box(K.x + x, 0, K.z + s * KAV_D / 2, 0.14, 0.7, 0.14, '#e9e2d0');
      for (let z = -KAV_D / 2; z <= KAV_D / 2; z += 2) for (const s of [-1, 1]) pr.box(K.x + s * KAV_W / 2, 0, K.z + z, 0.14, 0.7, 0.14, '#e9e2d0');
      pr.box(K.x, 0, depan - 1.2, 0.2, 2.4, 0.2, '#6b4a2a');
      const sg = signMesh('KAVLING ' + K.n.toUpperCase(), 5.4, 0.9, '#f4ecd8', '#2a6f4f'); sg.position.set(K.x, 2.1, depan - 1.08); statik.add(sg);
      return;
    }
    const PV = '#8d8a84', TP = '#cfc8b8', P = (x, z, w, d) => pr.box(K.x + x, 0, K.z + z, w, 0.07, d, PV);
    for (const x of [-10, 10]) { P(x, -2.5, 4, KAV_D - 5); for (const s of [-1, 1]) pr.box(K.x + x + s * 2.15, 0, K.z - 2.5, 0.3, 0.12, KAV_D - 5, TP); }
    P(0, KAV_D / 2 - 4, 24, 4); P(0, KAV_D / 2 + 2.5, 6, 8);
    for (const x of [-10, 10]) for (let z = -20; z <= 14; z += 11.5) pr.box(K.x + x + 2.4, 0, K.z + z, 0.12, 2.4, 0.12, '#3a3a3a').box(K.x + x + 2.4, 2.3, K.z + z, 0.32, 0.16, 0.32, 'win');
    pr.box(K.x, 0, K.z - 2.5, 3.2, 0.06, KAV_D - 12, '#8fb35a');
    for (let z = -22; z <= 16; z += 5.5) pr.bola(K.x + (r() - 0.5) * 1.2, 0, K.z + z, 1.1, 0.8, 1.1, '~#6f9a45');
    const T = '#e3d6bd';
    pr.box(K.x, 0, K.z - KAV_D / 2, KAV_W, 1.1, 0.25, T);
    for (const s of [-1, 1]) { pr.box(K.x + s * KAV_W / 2, 0, K.z, 0.25, 1.1, KAV_D, T); pr.box(K.x + s * (3.4 + (KAV_W / 2 - 3.4) / 2), 0, depan, KAV_W / 2 - 3.4, 1.1, 0.25, T); }
    for (const s of [-1, 1]) { pr.box(K.x + s * 3.1, 0, depan, 0.6, 4.4, 0.6, '#f1e6cf'); pr.box(K.x + s * 3.1, 4.4, depan, 0.8, 0.3, 0.8, '#b5523b'); }
    pr.box(K.x, 3.5, depan, 5.6, 0.95, 0.4, '#2a6f4f');
    const sg = signMesh('PERUMAHAN ' + (p.nama || '').toUpperCase(), 5.5, 0.66, '#2a6f4f', '#ffd166'); sg.position.set(K.x, 3.98, depan + 0.32); statik.add(sg);
    const sb = signMesh('BLOK ' + p.blok, 2.4, 0.5, '#ffd166', '#2a6f4f'); sb.position.set(K.x, 3.1, depan + 0.32); sb.scale.setScalar(0.9); statik.add(sb);
    pohon(pr, K.x - 7, depan - 1.5, r); pohon(pr, K.x + 7, depan - 1.5, r);
  });
  statik.add(pr.build());
  // pohon di pusat kota
  const ph = new VB(); const pos = [];
  for (let i = 0, n = 0; i < 3000 && n < 160; i++) {
    const x = 34 + r() * 104, z = -84 + r() * 101;
    if (dalamJalanBaru(x, z, 1.6) || kena(x, z, 3) || LAHAN_KOTA.some(L => Math.abs(x - L.x) < L.w / 2 + 1 && Math.abs(z - L.z) < L.d / 2 + 1)) continue;
    if (footprints.some(f => Math.abs(x - f.x) < f.w / 2 + 1.5 && Math.abs(z - f.z) < f.d / 2 + 1.5)) continue;
    pohon(ph, x, z, r, r() < 0.3 ? 'kelapa' : 'biasa'); pos.push([x, z]); n++;
  }
  statik.add(ph.build());
  return pos;
}
// ---------------------------------------------------------------- hutan & pegunungan di luar batas kabupaten
const TEBAL_HUTAN = 30;
const MAT_GUNUNG = [];
const GEO_BUKIT = (() => { const g = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, Math.pow(y, 1.6)); } g.computeVertexNormals(); return g; })();
function bangunHutan(statik, r, ringan) {
  const { x0, x1, z0, z1 } = BATAS, T = TEBAL_HUTAN;
  // lantai hutan (di bawah tanah kabupaten)
  const lantai = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 900, z1 - z0 + 900).rotateX(-Math.PI / 2), mat('#5f7a3a'));
  lantai.position.set((x0 + x1) / 2 - 300, -0.4, (z0 + z1) / 2); lantai.receiveShadow = true; statik.add(lantai);
  // arah keluar tiap sisi batas
  let luas = 0; for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) luas += (POLY[j][0] - POLY[i][0]) * (POLY[j][1] + POLY[i][1]);
  const ccw = luas > 0;
  const geoBatang = new THREE.CylinderGeometry(0.16, 0.24, 1, 5); geoBatang.translate(0, 0.5, 0);
  const geoBulat = new THREE.IcosahedronGeometry(1, 0);
  const geoCemara = new THREE.ConeGeometry(1, 1, 6); geoCemara.translate(0, 0.5, 0);
  const GEO = { batang: geoBatang, bulat: geoBulat, cemara: geoCemara, semak: geoBulat }, kumpul = new Map(), CH = 80;
  const HIJAU = ['#3f6b2e', '#4a7a34', '#36602a', '#55843a', '#2f5426'], CEMARA = ['#2c5130', '#34603a', '#27482b', '#3d6b3f'];
  const taruh = (jenis, x, y, z, sx, sy, sz, c) => { const k = jenis + '|' + Math.floor(x / CH) + '|' + Math.floor(z / CH); if (!kumpul.has(k)) kumpul.set(k, []); kumpul.get(k).push([x, y, z, sx, sy, sz, c, r() * 6.28]); };
  const papan = [];
  const rapat = ringan ? 0.28 : 0.55;   // pohon per satuan panjang tepi per lapis
  for (let i = 0; i < POLY.length; i++) {
    const [ax, az] = POLY[i], [bx, bz] = POLY[(i + 1) % POLY.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
    let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (diPoly(mx + nx * 3, mz + nz * 3)) { nx = -nx; nz = -nz; }
    if (diLaut(mx + nx * 6, mz + nz * 6) || mx > PANTAI(mz) - 25) continue;   // sisi laut: tanpa hutan
    const n = Math.ceil(L * T * rapat / 6);
    for (let k = 0; k < n; k++) {
      const t = r(), d = 1 + Math.pow(r(), 0.8) * T, x = ax + (bx - ax) * t + nx * d, z = az + (bz - az) * t + nz * d;
      if (diPoly(x, z) || kena(x, z, 3) || kena(x + 3, z, 3) || kena(x - 3, z, 3) || kena(x, z + 3, 3) || kena(x, z - 3, 3)) continue;
      const h = 3.5 + Math.min(1, d / T) * 5 + r() * 3;
      taruh('batang', x, 0, z, 1, h * 0.55, 1, '#5a4029');
      if (r() < 0.45) { const w = 1.4 + r() * 1.1; taruh('cemara', x, h * 0.3, z, w, h * 0.85, w, CEMARA[Math.floor(r() * 4)]); taruh('cemara', x, h * 0.62, z, w * 0.7, h * 0.6, w * 0.7, CEMARA[Math.floor(r() * 4)]); }
      else { const w = 1.6 + r() * 1.4; taruh('bulat', x, h * 0.62, z, w, w * 0.9, w, HIJAU[Math.floor(r() * 5)]); taruh('bulat', x + (r() - 0.5) * 1.2, h * 0.62 + w * 0.55, z + (r() - 0.5) * 1.2, w * 0.7, w * 0.65, w * 0.7, HIJAU[Math.floor(r() * 5)]); }
    }
    for (let s = 0; s < L; s += 2) { const t = s / L; if (kena(ax + (bx - ax) * t + nx, az + (bz - az) * t + nz, 3)) continue; taruh('semak', ax + (bx - ax) * t + nx * (0.6 + r()), 0.3, az + (bz - az) * t + nz * (0.6 + r()), 0.9 + r() * 0.8, 0.7 + r() * 0.5, 0.9 + r() * 0.8, HIJAU[Math.floor(r() * 5)]); }
    for (let s = 20; s < L; s += 90) { const t = s / L; papan.push([ax + (bx - ax) * t - nx * 2, az + (bz - az) * t - nz * 2, Math.atan2(-nx, -nz)]); }
  }
  const matPohon = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), o = new THREE.Object3D(), cl = new THREE.Color();
  for (const [k, list] of kumpul) {
    const im = new THREE.InstancedMesh(GEO[k.split('|')[0]], matPohon, list.length); im.receiveShadow = true;
    list.forEach(([x, y, z, sx, sy, sz, c, ry], i) => { o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.set(sx, sy, sz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, cl.set(c)); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); statik.add(im);
  }
  for (const [x, z, ry] of papan) {
    if (kena(x, z, 1 | 2)) continue;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const v = new VB(); v.box(-1.3, 0, 0, 0.18, 2.6, 0.18, '#4a3420').box(1.3, 0, 0, 0.18, 2.6, 0.18, '#4a3420'); g.add(v.build());
    const s1 = signMesh('⛔ BATAS KABUPATEN', 3.0, 0.75, '#c1121f', '#ffffff'); s1.position.set(0, 2.15, 0.1); g.add(s1);
    const s2 = signMesh('HUTAN LARANGAN', 3.0, 0.6, '#1b1b1b', '#ffd166'); s2.position.set(0, 1.5, 0.1); g.add(s2);
    statik.add(g);
  }
  // pegunungan di kejauhan (barat, utara, selatan)
  MAT_GUNUNG.length = 0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let lapis = 0; lapis < 2; lapis++) {
    const n = lapis ? 34 : 46, rx = (x1 - x0) / 2 + T + 260 + lapis * 300, rz = (z1 - z0) / 2 + T + 260 + lapis * 300;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.12;
      if (Math.cos(a) > 0.4) continue;
      const tinggi = ((lapis ? 70 : 38) + r() * (lapis ? 55 : 30)) * 3.2, lebar = tinggi * (0.75 + r() * 0.35);
      const m = new THREE.MeshLambertMaterial({ fog: false });
      m.userData.dasar = new THREE.Color(lapis ? '#7c9196' : ['#5d7b4c', '#668553', '#557346'][i % 3]); m.userData.kabut = lapis ? 0.5 : 0.28; MAT_GUNUNG.push(m);
      const g = new THREE.Mesh(GEO_BUKIT, m); const lb = lebar * (1.6 + r() * 0.8);
      g.position.set(cx + Math.cos(a) * rx * (0.95 + r() * 0.1), -6, cz + Math.sin(a) * rz * (0.95 + r() * 0.1)); g.rotation.y = r() * 3;
      const jarak = Math.max(BATAS.x0 - g.position.x, g.position.x - BATAS.x1, BATAS.z0 - g.position.z, g.position.z - BATAS.z1) - T - 20;   // jangan sampai masuk ke peta
      if (jarak < 60) continue;
      const rb = Math.min(lb, jarak * 0.95);
      g.scale.set(rb, tinggi * 0.75 * Math.min(1, rb / lb * 1.3), rb * 0.8);
      statik.add(g);
    }
  }
}
function warnaGunung(kabut, malam) {
  for (const m of MAT_GUNUNG) { m.color.copy(m.userData.dasar).lerp(kabut, m.userData.kabut); if (malam) m.color.multiplyScalar(0.32); }
}
// ---------------------------------------------------------------- daerah: sawah, tambak, sungai, jalan asli, jembatan, rel rencana, bandara rencana, lahan rencana
function kenaRencana(x, z, m = 0) { return LAHAN_RENCANA.some(L => Math.abs(x - L.x) < L.w / 2 + m && Math.abs(z - L.z) < L.d / 2 + m); }
const PETAK_SAWAH = [];
function bangunDaerah(statik, r, footprints, ringan) {
  PETAK_SAWAH.length = 0;
  const C = BATAS, CH = 240, petak = new Map();
  const vb = (x, z) => { const k = Math.floor(x / CH) + '|' + Math.floor(z / CH); if (!petak.has(k)) petak.set(k, new VB()); return petak.get(k); };
  // sungai (rumput tepi, lumpur, air)
  const tepiR = [], lumpur = [], air = [];
  for (const s of SUNGAI) { tepiR.push(pita(s.p, s.lebar + 9, 0.03)); lumpur.push(pita(s.p, s.lebar + 3.5, 0.07)); air.push(pita(s.p, s.lebar, 0.11)); }
  // lapisan sungai: urutan gambar & offset kedalaman tetap → tidak belang/sobek di tikungan
  const lapis = (g, m, urut, off) => { const mm = m.clone(); mm.polygonOffset = true; mm.polygonOffsetFactor = off; mm.polygonOffsetUnits = off * 4; mm.side = THREE.DoubleSide; if (g.material) g.material = mm; g.renderOrder = urut; return g; };
  statik.add(lapis(gabungPita(tepiR, mat('#7d9a4a')), mat('#7d9a4a'), 1, -1)); statik.add(lapis(gabungPita(lumpur, mat('#6f5a3c')), mat('#6f5a3c'), 2, -2)); statik.add(lapis(gabungPita(air, MAT_SUNGAI), MAT_SUNGAI, 3, -3));
  // jalan asli: aspal + tepi + marka putus-putus (tol & raya)
  const tepiJ = [], aspal = [], marka = new VB();
  for (const jl of JALAN_ASLI) {
    const w = LEBAR_JALAN[jl.k];
    tepiJ.push(pita(jl.p, w + 1.2, 0.075)); aspal.push(pita(jl.p, w, 0.09));
    if (jl.k === 'tol' || jl.k === 'raya') for (let k = 0; k + 1 < jl.p.length; k++) {
      const [ax, az] = jl.p[k], [bx, bz] = jl.p[k + 1], L = Math.hypot(bx - ax, bz - az);
      for (let s = 2; s < L; s += 6) { const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L; marka.box(x, 0.1, z, 0.5, 0.01, 0.5, '#f1f1f1'); }
    }
  }
  statik.add(gabungPita(tepiJ, mat('#cfc8b8'))); statik.add(gabungPita(aspal, mat('#6e6b67'))); statik.add(marka.build({ shadow: false }));
  // jembatan
  const jk = new VB();
  for (const J of JEMBATAN) {
    const panjang = J.lebar + 14;
    if (J.besar) jembatanBesar(statik, J.x, J.z, panjang, J.ry, LEBAR_JALAN[J.jalan] + 2);
    else {
      const m = new THREE.Group(); m.position.set(J.x, 0, J.z); m.rotation.y = J.ry; const w = LEBAR_JALAN[J.jalan] + 1;
      const v = new VB(); v.box(0, 0.05, 0, w + 0.8, 0.4, panjang, '#c9c3b6').box(0, 0.45, 0, w - 0.4, 0.02, panjang, '#6e6b67');
      for (const s of [-1, 1]) v.box(s * (w / 2 + 0.25), 0.45, 0, 0.25, 0.8, panjang, '#e9e2d0');
      m.add(v.build()); statik.add(m);
    }
  }
  // sawah & tambak berpetak di seluruh daerah
  const SAWAH = ['#9cc95a', '#8fbf4f', '#6fa53a', '#b8c95a', '#d6c25a', '#7fa6a0'], PEMATANG = '#8a6d47';
  const bebas = (x, z) => diPoly(x - 12, z - 8) && diPoly(x + 12, z + 8) && diPoly(x - 12, z + 8) && diPoly(x + 12, z - 8) && !diKota(x, z, -14) && kotakBebas(x, z, 24, 16, 15) && !diBandara(x, z);
  for (let x = C.x0 + 4; x < C.x1; x += 24) for (let z = C.z0 + 4; z < C.z1; z += 16) {
    const cx = x + 12, cz = z + 8;
    if (!bebas(cx, cz)) {   // petak penuh tidak muat (dekat jalan/sungai): isi petak kecil di sela-sela
      for (const [ox, oz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) {
        const sx = cx + ox, sz = cz + oz;
        if (!diPoly(sx, sz) || diKota(sx, sz, -8) || !kotakBebas(sx, sz, 12, 8, 15) || diBandara(sx, sz)) continue;
        const v = vb(sx, sz), c = PANTAI(sz) - sx < 200 ? null : SAWAH[Math.floor(r() * 5)];
        if (!c) { tandaKotak(sx, sz, 12, 8, 16); v.box(sx, -0.05, sz, 11, 0.25, 7, '#9c8461'); v.box(sx, 0.05, sz, 9.6, 0.22, 5.6, 'water'); continue; }
        tandaKotak(sx, sz, 12, 8, 16); PETAK_SAWAH.push([sx, sz, c, 0.5]);
        v.box(sx, -0.06, sz, 11.4, 0.1, 7.4, c); v.box(sx, -0.04, sz + 3.8, 12, 0.22, 0.5, PEMATANG); v.box(sx + 5.8, -0.04, sz, 0.5, 0.22, 8, PEMATANG);
      }
      continue;
    }
    const v = vb(cx, cz);
    if (PANTAI(cz) - cx < 200) {   // dekat pantai: tambak bandeng & udang
      tandaKotak(cx, cz, 24, 16, 16); v.box(cx, -0.05, cz, 23, 0.25, 15, '#9c8461'); v.box(cx, 0.05, cz, 20.6, 0.22, 12.6, 'water');
      if (r() < 0.25) { v.box(cx + 7, 0.27, cz - 4, 1.4, 0.12, 0.25, '#e9e2d0'); v.box(cx + 7, 0.27, cz - 4, 0.25, 0.12, 1.4, '#e9e2d0'); }
      if (r() < 0.04) { v.box(cx - 9, 0.2, cz + 5, 2.2, 1.6, 2, '#a07a4f').box(cx - 9, 1.8, cz + 5, 2.8, 0.25, 2.6, '#6b4a2a'); }
      continue;
    }
    const c = r() < 0.12 ? '#a9b56a' : SAWAH[Math.floor(r() * SAWAH.length)];
    tandaKotak(cx, cz, 24, 16, 16);
    if (c !== '#7fa6a0' && c !== '#a9b56a') PETAK_SAWAH.push([cx, cz, c]);
    v.box(cx, -0.06, cz, 23.4, 0.1, 15.4, c);
    v.box(cx, -0.04, cz + 7.8, 24, 0.22, 0.6, PEMATANG); v.box(cx + 11.8, -0.04, cz, 0.6, 0.22, 16, PEMATANG);
    if (r() < 0.012) { v.box(cx, 0.04, cz, 2.4, 1.4, 2.2, '#b08a5a').box(cx, 1.44, cz, 3, 0.25, 2.8, '#7a5a3a'); }
    if (r() < 0.03 && titikBebas(cx + 11.6, cz + 7.6)) pohon(v, cx + 11.6, cz + 7.6, r, 'kelapa');
  }
  for (const v of petak.values()) statik.add(v.build({ shadow: false }));
  // pohon & bambu di tepi sungai, pohon di tepi jalan
  const tp = new VB();
  for (const s of SUNGAI) for (let k = 0; k + 1 < s.p.length; k++) {
    const [ax, az] = s.p[k], [bx, bz] = s.p[k + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / (L || 1), nz = (bx - ax) / (L || 1);
    for (let d = 0; d < L; d += 10 + r() * 10) { const t = d / L, sd = r() < 0.5 ? 1 : -1, off = s.lebar / 2 + 3 + r() * 3, x = ax + (bx - ax) * t + nx * off * sd, z = az + (bz - az) * t + nz * off * sd; if (!titikBebas(x, z)) continue; if (r() < 0.5) pohon(tp, x, z, r, r() < 0.5 ? 'kelapa' : 'biasa'); else tp.bola(x, 0, z, 2.2, 1.5, 2.2, '~#5f8a3a'); }
  }
  statik.add(tp.build());
  // rencana jalur kereta (koridor rel asli): tanah diratakan + patok + papan
  const pk = new Map(), pv = (x, z) => { const k = Math.floor(x / CH) + '|' + Math.floor(z / CH); if (!pk.has(k)) pk.set(k, new VB()); return pk.get(k); };
  const koridor = [];
  for (const p of REL) {
    koridor.push(pita(p, 20, 0.02));
    for (let k = 0; k + 1 < p.length; k++) {
      const [ax, az] = p[k], [bx, bz] = p[k + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / (L || 1), nz = (bx - ax) / (L || 1);
      for (let d = 0; d < L; d += 10) { const x = ax + (bx - ax) * d / L, z = az + (bz - az) * d / L; if (kena(x, z, 3)) continue; for (const s of [-1, 1]) pv(x, z).box(x + nx * 11 * s, 0, z + nz * 11 * s, 0.3, 1.0, 0.3, '#e9e2d0').box(x + nx * 11 * s, 0.8, z + nz * 11 * s, 0.32, 0.22, 0.32, '#d62828'); }
    }
  }
  statik.add(gabungPita(koridor, mat('#b8a77a')));
  const papanRencana = (x, z, ry, judul, sub, lebar = 7) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const v = new VB(); v.box(-lebar / 2 + 0.4, 0, 0, 0.25, 3.6, 0.25, '#4a3420').box(lebar / 2 - 0.4, 0, 0, 0.25, 3.6, 0.25, '#4a3420'); g.add(v.build());
    const s1 = signMesh(judul, lebar, 1.3, '#0f4c5c', '#ffd166'); s1.position.set(0, 3.1, 0.15); g.add(s1);
    const s2 = signMesh(sub, lebar, 0.8, '#f4ecd8', '#16324f'); s2.position.set(0, 2.05, 0.15); g.add(s2);
    const s3 = signMesh('💬 komen like terbanyak = dibangun', lebar, 0.6, '#ffd166', '#3d2a00'); s3.position.set(0, 1.35, 0.15); g.add(s3);
    statik.add(g);
  };
  for (const p of REL) { let jarak = 0; for (let k = 0; k + 1 < p.length; k++) { const [ax, az] = p[k], [bx, bz] = p[k + 1], L = Math.hypot(bx - ax, bz - az); jarak += L; if (jarak > 260) { jarak = 0; const nx = -(bz - az) / (L || 1), nz = (bx - ax) / (L || 1); if (titikBebas(ax + nx * 14, az + nz * 14)) papanRencana(ax + nx * 14, az + nz * 14, Math.atan2(nx, nz), 'RENCANA JALUR KERETA API', 'Surabaya – Sidoarjo – Malang'); } } }
  // bandara rencana (lahan Juanda asli)
  if (BANDARA) {
    const P = BANDARA.p, shp = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
    const gb = new THREE.ShapeGeometry(shp, 1); gb.rotateX(-Math.PI / 2);
    const mb = new THREE.Mesh(gb, mat('#c2a172')); mb.position.y = 0.01; statik.add(mb);
    const v = new VB();
    for (let k = 0; k < P.length; k++) { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % P.length], L = Math.hypot(bx - ax, bz - az); for (let d = 0; d < L; d += 8) v.box(ax + (bx - ax) * d / L, 0, az + (bz - az) * d / L, 0.25, 1.1, 0.25, '#e9e2d0'); }
    for (const lnd of BANDARA.landasan || []) for (let k = 0; k + 1 < lnd.length; k++) { const [ax, az] = lnd[k], [bx, bz] = lnd[k + 1], L = Math.hypot(bx - ax, bz - az); for (let d = 0; d < L; d += 20) v.box(ax + (bx - ax) * d / L, 0.04, az + (bz - az) * d / L, 4, 0.03, 4, '#f4f4f4'); }
    statik.add(v.build({ shadow: false }));
    let sx = 0, sz = 0; for (const [x, z] of P) { sx += x; sz += z; }
    papanRencana(sx / P.length, sz / P.length, 0, 'LAHAN BANDARA', 'rencana bandar udara · Juanda', 10);
  }
  // lahan-lahan rencana lain
  for (const L of LAHAN_RENCANA) {
    if (footprints.some(f => Math.abs(f.x - L.x) < L.w / 2 && Math.abs(f.z - L.z) < L.d / 2)) continue;
    const v = pv(L.x, L.z); v.box(L.x, -0.02, L.z, L.w, 0.08, L.d, '#c2a172');
    for (let x = -L.w / 2; x <= L.w / 2; x += 3) for (const sz of [-1, 1]) v.box(L.x + x, 0, L.z + sz * L.d / 2, 0.2, 1.0, 0.2, '#e9e2d0');
    for (let z = -L.d / 2; z <= L.d / 2; z += 3) for (const sx of [-1, 1]) v.box(L.x + sx * L.w / 2, 0, L.z + z, 0.2, 1.0, 0.2, '#e9e2d0');
    papanRencana(L.x, L.z + L.d / 2 + 2, 0, L.nama, L.sub, 7);
  }
  for (const v of pk.values()) statik.add(v.build({ shadow: false }));
  // papan nama kecamatan
  for (const [n, x0k, z0k] of SDA.kecamatan) { let x = x0k, z = z0k; for (let k = 0; k < 40 && !titikBebas(x, z); k++) { x = x0k + Math.cos(k) * k * 3; z = z0k + Math.sin(k) * k * 3; } if (!titikBebas(x, z)) continue; const g = new THREE.Group(); g.position.set(x, 0, z); const v = new VB(); v.box(-2.4, 0, 0, 0.3, 3.4, 0.3, '#3a3a3a').box(2.4, 0, 0, 0.3, 3.4, 0.3, '#3a3a3a'); g.add(v.build()); const s = signMesh('KEC. ' + n.toUpperCase(), 5.4, 1.1, '#2a6f4f', '#ffffff'); s.position.set(0, 2.9, 0.18); g.add(s); statik.add(g); }
}

// bangjo: lampu merah/kuning/hijau yang bergantian (arah x dan arah z)
const GEO_BANGJO = new THREE.SphereGeometry(0.13, 10, 8);
const MAT_BANGJO = {};
for (const a of ['x', 'z']) MAT_BANGJO[a] = {
  m: new THREE.MeshStandardMaterial({ color: '#5a1414', emissive: '#ff2a2a', emissiveIntensity: 0 }),
  k: new THREE.MeshStandardMaterial({ color: '#5a4a14', emissive: '#ffc21a', emissiveIntensity: 0 }),
  h: new THREE.MeshStandardMaterial({ color: '#14451f', emissive: '#22e06b', emissiveIntensity: 0 }),
};
function stepBangjo(t) {
  const c = t % 16;   // 0–6.5 hijau arah x, 6.5–8 kuning x, 8–14.5 hijau z, 14.5–16 kuning z
  const st = { x: c < 6.5 ? 'h' : c < 8 ? 'k' : 'm', z: c < 8 ? 'm' : c < 14.5 ? 'h' : 'k' };
  for (const a of ['x', 'z']) for (const w of ['m', 'k', 'h']) MAT_BANGJO[a][w].emissiveIntensity = st[a] === w ? 2.4 : 0;
}

// rumah warga perumahan: berteras, tiang, kanopi, lampu teras, pagar tanaman. (x, z) = pusat badan rumah, rot = derajat (sama dengan holder: depan menghadap +z diputar -rot)
function rumahTeras(vb, x, z, rot, c, r, vbMobil = vb, jenis = 'mobil') {
  const th = -rot * Math.PI / 180, cs = Math.round(Math.cos(th)), sn = Math.round(Math.sin(th)), putar = Math.abs(sn) === 1;
  const B = (lx, y, lz, w, h, d, col, bola) => {
    const wx = x + lx * cs + lz * sn, wz = z - lx * sn + lz * cs;
    vb[bola ? 'bola' : 'box'](wx, y, wz, putar ? d : w, h, putar ? w : d, col);
  };
  // rumah modern 2 lantai: lantai atas mundur + balkon, atap datar, aksen batu & kayu, carport + mobil, pagar minimalis, lampu taman
  const tembok = ['#f4f1ea', '#e8e2d6', '#efe6d4', '#dfe5e8', '#e9dccb', '#f6efe3'][Math.floor(r() * 6)];
  const atas = r() < 0.5 ? '#f7f5f0' : ['#4a4f55', '#5b4636', '#3f5866'][Math.floor(r() * 3)];
  const GELAP = '#2b2f33', KAYU = '#8a5a3a', BATU = '#8c8578';
  B(0, 0, 0.45, 3.6, 0.15, 4.4, '#d9d2c3');                                   // pondasi halaman
  B(0, 0.15, 0, 3.0, 1.9, 2.6, tembok);                                      // lantai 1
  B(0, 0.15, 1.31, 3.0, 0.42, 0.05, BATU);                                   // aksen batu alam
  B(0.75, 0.15, 1.32, 0.72, 1.5, 0.05, '#5a3a22');                           // pintu kayu
  B(-0.6, 0.62, 1.32, 1.25, 1.0, 0.05, 'win');                               // jendela besar lantai 1
  for (const s of [-1, 1]) B(s * 1.51, 0.75, -0.2, 0.05, 0.8, 1.0, 'win');
  B(0, 2.05, 0.35, 3.3, 0.12, 3.3, '#ece7de');                               // plat lantai 2 + kanopi teras
  B(0.15, 2.17, -0.25, 2.6, 1.6, 2.1, atas);                                 // lantai 2 (mundur)
  B(-0.75, 2.25, 0.81, 0.9, 1.35, 0.05, KAYU);                               // panel kayu
  for (let k = -1; k <= 1; k++) B(-0.75 + k * 0.28, 2.25, 0.84, 0.06, 1.35, 0.03, '#6b4428');
  B(0.6, 2.4, 0.81, 1.15, 1.0, 0.05, 'win');                                 // jendela kaca lantai 2
  B(0.15, 3.77, -0.2, 3.1, 0.14, 2.65, '#3b3f45');                           // atap datar
  B(0.15, 3.91, -0.2, 2.6, 0.1, 2.2, '#4a4f55');
  B(0.2, 2.17, 1.95, 2.9, 0.08, 0.05, GELAP); B(0.2, 2.6, 1.95, 2.9, 0.06, 0.05, GELAP);   // pagar balkon
  for (let k = -3; k <= 3; k++) B(0.2 + k * 0.45, 2.17, 1.95, 0.04, 0.45, 0.04, GELAP);
  B(1.35, 0.15, 1.95, 0.12, 1.9, 0.12, '#ece7de');                           // tiang teras
  B(0.75, 0.15, 2.0, 0.9, 0.05, 1.3, '#cfc8b8');                             // jalan setapak
  B(-0.6, 0, 2.2, 1.7, 0.17, 1.85, '#b3ada3');                               // carport
  {                                                                          // kendaraan sepaket rumah: mobil / motor / pikap / becak / gerobak / sepeda
    const M = (lx, y, lz, w, h, d, col) => { const wx = x + lx * cs + lz * sn, wz = z - lx * sn + lz * cs; vbMobil.box(wx, y, wz, putar ? d : w, h, putar ? w : d, col); };
    const warna = ['#c0392b', '#2c3e50', '#ecf0f1', '#7f8c8d', '#2f6db5', '#1b1b1b', '#e67e22', '#27ae60'][Math.floor(r() * 8)];
    const X = -0.6, Z = 2.2, Y = 0.17, RODA = '#1d1f22', KACA = '#9fb3c1';
    const roda = (lx, lz, tebal = 0.1, besar = 0.26) => M(lx, Y, lz, tebal, besar, besar + 0.04, RODA);
    if (jenis === 'mobil' || jenis === 'pikap' || jenis === 'pickup') {
      M(X, Y + 0.13, Z, 0.95, 0.38, 1.75, warna);
      if (jenis === 'mobil') M(X, Y + 0.51, Z - 0.08, 0.86, 0.32, 1.0, KACA);
      else { M(X, Y + 0.51, Z + 0.45, 0.86, 0.34, 0.7, KACA); M(X - 0.44, Y + 0.51, Z - 0.42, 0.06, 0.2, 0.9, warna); M(X + 0.44, Y + 0.51, Z - 0.42, 0.06, 0.2, 0.9, warna); M(X, Y + 0.51, Z - 0.86, 0.9, 0.2, 0.05, warna); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) roda(X + sx * 0.46, Z + sz * 0.55);
    } else if (jenis === 'motor') {
      roda(X, Z + 0.45, 0.08, 0.3); roda(X, Z - 0.45, 0.08, 0.3);
      M(X, Y + 0.18, Z, 0.2, 0.22, 0.85, warna); M(X, Y + 0.4, Z - 0.12, 0.22, 0.09, 0.45, '#1b1b1b');
      M(X, Y + 0.3, Z + 0.42, 0.16, 0.38, 0.1, warna); M(X, Y + 0.66, Z + 0.4, 0.52, 0.05, 0.05, '#2b2f33');
    } else if (jenis === 'sepeda') {
      roda(X, Z + 0.4, 0.05, 0.36); roda(X, Z - 0.4, 0.05, 0.36);
      M(X, Y + 0.3, Z, 0.05, 0.05, 0.8, warna); M(X, Y + 0.18, Z - 0.1, 0.05, 0.32, 0.05, warna);
      M(X, Y + 0.5, Z - 0.12, 0.14, 0.05, 0.2, '#1b1b1b'); M(X, Y + 0.56, Z + 0.36, 0.42, 0.04, 0.04, '#2b2f33'); M(X, Y + 0.3, Z + 0.36, 0.04, 0.28, 0.04, warna);
    } else if (jenis === 'becak') {
      roda(X - 0.38, Z + 0.4, 0.06, 0.34); roda(X + 0.38, Z + 0.4, 0.06, 0.34); roda(X, Z - 0.55, 0.06, 0.34);
      M(X, Y + 0.25, Z + 0.35, 0.78, 0.3, 0.55, warna);             // kursi penumpang di depan
      M(X, Y + 0.55, Z + 0.15, 0.78, 0.35, 0.12, warna);
      M(X, Y + 0.9, Z + 0.3, 0.84, 0.06, 0.6, '#f2c94c');           // tenda
      M(X - 0.4, Y + 0.55, Z + 0.3, 0.04, 0.36, 0.5, '#f2c94c'); M(X + 0.4, Y + 0.55, Z + 0.3, 0.04, 0.36, 0.5, '#f2c94c');
      M(X, Y + 0.3, Z - 0.3, 0.06, 0.06, 0.6, '#2b2f33'); M(X, Y + 0.55, Z - 0.55, 0.22, 0.06, 0.24, '#1b1b1b');   // rangka & sadel pengayuh
    } else {                                                                 // gerobak kayu
      roda(X - 0.42, Z, 0.06, 0.4); roda(X + 0.42, Z, 0.06, 0.4);
      M(X, Y + 0.32, Z, 0.78, 0.36, 1.1, '#8a5a3a'); M(X, Y + 0.68, Z, 0.82, 0.04, 1.14, '#6b4428');
      M(X - 0.3, Y + 0.45, Z - 0.85, 0.05, 0.05, 0.7, '#6b4428'); M(X + 0.3, Y + 0.45, Z - 0.85, 0.05, 0.05, 0.7, '#6b4428');
      M(X, Y + 0.72, Z + 0.15, 0.5, 0.18, 0.4, ['#e67e22', '#27ae60', '#f2c94c'][Math.floor(r() * 3)]);   // muatan
    }
  }
  B(1.5, 0, 3.05, 1.4, 0.55, 0.08, GELAP); B(2.2, 0, 3.05, 0.2, 0.75, 0.2, '#ece7de'); B(0.75, 0, 3.05, 0.2, 0.75, 0.2, '#ece7de');   // pagar minimalis
  B(1.95, 0.15, 2.85, 0.07, 0.55, 0.07, GELAP); B(1.95, 0.7, 2.85, 0.14, 0.12, 0.14, 'win');   // lampu taman
  B(1.75, 0.15, 2.35, 0.5, 0.42, 0.5, '#5f8a3a'); B(-1.1, 0.15, -1.75, 0.4, 0.9, 0.4, '#4f7a35');   // tanaman
  B(2.3, 0, 0.6, 0.3, 0.55, 4.0, '~#5f8a3a');                                // pagar tanaman pembatas
}
// model rumah lama (1 lantai berteras), dipakai video "sebelum–sesudah" (kota.modelRumah = "lama")
function rumahTerasLama(vb, x, z, rot, c, r) {
  const th = -rot * Math.PI / 180, cs = Math.round(Math.cos(th)), sn = Math.round(Math.sin(th)), putar = Math.abs(sn) === 1;
  const B = (lx, y, lz, w, h, d, col, bola) => {
    const wx = x + lx * cs + lz * sn, wz = z - lx * sn + lz * cs;
    vb[bola ? 'bola' : 'box'](wx, y, wz, putar ? d : w, h, putar ? w : d, col);
  };
  const atap = ['#b5523b', '#8e3b2e', '#9c4a2f', '#6f4a3a', '#3f5866'][Math.floor(r() * 5)];
  B(0, 0, 0.6, 3.4, 0.18, 4.4, '#bdb5a6');                     // pondasi + lantai teras
  B(0, 0.18, 0, 3.0, 2.0, 2.6, c);                            // badan rumah
  B(0, 2.18, 0, 3.5, 0.28, 3.1, atap); B(0, 2.46, 0, 2.9, 0.28, 2.3, atap); B(0, 2.74, 0, 2.1, 0.28, 1.4, atap); B(0, 3.02, 0, 1.1, 0.2, 0.6, atap);
  B(0, 0.18, 2.0, 3.0, 0.06, 1.4, '#e3d5bb');                 // lantai teras (keramik)
  for (const s of [-1, 1]) B(s * 1.38, 0.24, 2.58, 0.14, 1.86, 0.14, '#f4efe6');   // tiang teras
  B(0, 2.08, 2.05, 3.3, 0.12, 1.6, atap);                     // kanopi teras
  B(-0.55, 0.24, 1.31, 0.62, 1.28, 0.05, '#6d4527');          // pintu
  B(0.7, 0.95, 1.31, 0.8, 0.62, 0.05, 'win');                 // jendela depan
  for (const s of [-1, 1]) B(s * 1.51, 0.95, 0, 0.05, 0.6, 0.8, 'win');
  B(0, 1.9, 1.33, 0.18, 0.1, 0.06, 'win');                    // lampu teras
  B(0.95, 0.24, 2.35, 0.32, 0.3, 0.32, '#a0522d'); B(0.95, 0.5, 2.35, 0.5, 0.45, 0.5, '~#6f9a45', true);   // pot bunga
  B(2.3, 0, 0.7, 0.32, 0.55, 3.9, '~#5f8a3a');                // pagar tanaman pembatas dengan tetangga
  B(-0.55, 0, 3.05, 0.8, 0.06, 0.8, '#cfc8b8');               // jalan setapak ke teras
}
export const TIPE = {
  gapura: { label: 'Gapura', w: 8, d: 2, build(vb, b, ex) {
    for (const s of [-3.3, 3.3]) {
      vb.box(s, 0, 0, 1.4, 0.5, 1.4, '#e8dcc6');
      vb.box(s, 0.5, 0, 1.1, 4.6, 1.1, '#b5523b');
      for (let y = 1; y < 5; y += 1) vb.box(s, y, 0, 1.16, 0.12, 1.16, '#8e3b2e');
      vb.box(s, 5.1, 0, 1.4, 0.4, 1.4, '#e8dcc6');
      vb.box(s, 5.5, 0, 0.8, 0.6, 0.8, '#b5523b').box(s, 6.1, 0, 0.4, 0.4, 0.4, '#e6b422');
    }
    vb.box(0, 4.3, 0, 7.6, 0.8, 0.9, '#8e3b2e');
    const sg = signMesh('SIDOARJOVERSE', 5.4, 1.0); sg.position.set(0, 3.75, 0.47); ex.push(sg);
    const sg2 = sg.clone(); sg2.rotation.y = Math.PI; sg2.position.z = -0.47; ex.push(sg2);
  } },
  alunalun: { label: 'Alun-alun', w: 12, d: 12, build(vb, b, ex, r) {
    vb.box(0, 0, 0, 12, 0.12, 12, '#d9cbb0');
    vb.box(0, 0.12, 0, 10, 0.08, 10, '#7cc46a');
    vb.box(0, 0.12, 0, 10, 0.09, 1.2, '#d9cbb0').box(0, 0.12, 0, 1.2, 0.09, 10, '#d9cbb0');
    // beringin kembar
    for (const sx of [-2.8, 2.8]) {
      vb.box(sx, 0.2, -2.8, 0.9, 2.6, 0.9, '#6b4a2a');
      vb.box(sx, 2.6, -2.8, 4.2, 1.8, 4.2, '#2f7d32').box(sx, 4.4, -2.8, 3.2, 1.2, 3.2, '#3a8f3d').box(sx, 5.6, -2.8, 1.8, 0.8, 1.8, '#46a049');
      for (const a of [-1.2, 1.2]) vb.box(sx + a, 1.2, -2.8 + a * 0.4, 0.15, 1.5, 0.15, '#6b4a2a');
    }
    // kolam air mancur tengah
    vb.box(0, 0.2, 0, 2.6, 0.45, 2.6, '#e8dcc6').box(0, 0.25, 0, 2.1, 0.42, 2.1, 'water').box(0, 0.6, 0, 0.5, 1.2, 0.5, '#e8dcc6').box(0, 1.8, 0, 1.0, 0.2, 1.0, '#e8dcc6');
    // bangku & lampu
    for (const [x, z] of [[-3, 3], [3, 3], [-3, 4.4], [3, 4.4]]) { vb.box(x, 0.2, z, 1.6, 0.35, 0.5, '#8a5a32'); vb.box(x, 0.55, z - 0.2, 1.6, 0.35, 0.1, '#8a5a32'); }
    for (const [x, z] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5], [-0.8, 4.8], [0.8, 4.8]]) { vb.box(x, 0, z, 0.18, 2.6, 0.18, '#333'); vb.box(x, 2.6, z, 0.45, 0.4, 0.45, 'lamp'); }
    for (let i = 0; i < 10; i++) { const x = (r() - 0.5) * 9, z = 1.5 + r() * 3.2; if (Math.abs(x) > 1.2) vb.box(x, 0.2, z, 0.5, 0.35, 0.5, ['#ff7aa2', '#ffd166', '#f4f1de'][i % 3]); }
  } },
  pendopo: { label: 'Pendopo', w: 10, d: 8, build(vb) {
    vb.box(0, 0, 0, 9.6, 0.6, 7.6, '#c9b79c');
    vb.box(0, 0, 4.1, 3, 0.3, 0.8, '#c9b79c');
    vb.box(0, 0.6, 0, 9, 0.06, 7, '#a7825a');
    for (const x of [-4, -1.4, 1.4, 4]) for (const z of [-3, 3]) vb.box(x, 0.6, z, 0.4, 3, 0.4, '#7a4a2a');
    for (const x of [-1.4, 1.4]) for (const z of [-1, 1]) vb.box(x, 0.6, z, 0.5, 3.6, 0.5, '#6a3d22');
    vb.box(0, 3.6, 0, 10.4, 0.45, 8.4, '#8e3b2e');
    vb.box(0, 4.05, 0, 8, 0.6, 6, '#a0452e');
    vb.box(0, 4.65, 0, 5.4, 0.7, 3.8, '#8e3b2e');
    vb.box(0, 5.35, 0, 3.0, 0.9, 1.8, '#a0452e');
    vb.box(0, 6.25, 0, 1.6, 0.35, 0.6, '#e6b422');
    vb.box(0, 0.66, 0, 4, 0.05, 3, '#b23a48');
    for (const x of [-4.6, 4.6]) { vb.box(x, 0, 4.4, 0.6, 0.9, 0.6, '#e8dcc6'); vb.box(x, 0.9, 4.4, 0.4, 0.6, 0.4, '#3f8f3a'); }
  } },
  masjid: { label: 'Masjid', w: 9, d: 9, build(vb) {
    vb.box(0, 0, 0, 8.4, 0.4, 8.4, '#d8d2c4');
    vb.box(0, 0.4, 0, 7, 3.4, 7, '#f6f2e8');
    vb.box(0, 3.8, 0, 7.4, 0.3, 7.4, '#1f7a4d');
    for (const s of [-1, 1]) for (const p of [-2.2, 0, 2.2]) {
      vb.box(p, 1.4, s * 3.51, 0.9, 1.5, 0.06, 'win'); vb.box(s * 3.51, 1.4, p, 0.06, 1.5, 0.9, 'win');
    }
    vb.box(0, 0.4, 3.52, 1.4, 2.2, 0.08, '#1f7a4d');
    // kubah bertingkat
    vb.box(0, 4.1, 0, 5, 0.9, 5, '#2e8b57').box(0, 5.0, 0, 4.2, 0.8, 4.2, '#2e8b57').box(0, 5.8, 0, 3.2, 0.7, 3.2, '#2e8b57').box(0, 6.5, 0, 2, 0.6, 2, '#2e8b57').box(0, 7.1, 0, 0.9, 0.4, 0.9, '#2e8b57');
    vb.box(0, 7.5, 0, 0.25, 1, 0.25, '#e6b422').box(0, 8.3, 0, 0.6, 0.15, 0.15, '#e6b422');
    // menara
    vb.box(3.6, 0, 3.6, 1.3, 9, 1.3, '#f6f2e8');
    for (const y of [3, 6]) vb.box(3.6, y, 3.6, 1.5, 0.3, 1.5, '#1f7a4d');
    vb.box(3.6, 9, 3.6, 1.6, 0.3, 1.6, '#1f7a4d').box(3.6, 9.3, 3.6, 1, 0.7, 1, '#2e8b57').box(3.6, 10, 3.6, 0.2, 0.7, 0.2, '#e6b422');
    vb.box(3.6, 7.2, 3.6, 1.36, 0.6, 1.36, 'win');
  } },
  posronda: { label: 'Pos Ronda', w: 3, d: 3, build(vb) {
    vb.box(0, 0, 0, 2.6, 0.6, 2.2, '#9c6b3c');
    for (const x of [-1.2, 1.2]) for (const z of [-1, 1]) vb.box(x, 0, z, 0.2, 2.3, 0.2, '#6b4a2a');
    vb.box(0, 2.3, 0, 3.1, 0.3, 2.7, '#8a6d3b').box(0, 2.6, 0, 2.2, 0.3, 1.8, '#9b7b45').box(0, 2.9, 0, 1.2, 0.3, 0.9, '#8a6d3b');
    vb.box(1.2, 1.2, 1.15, 0.22, 0.8, 0.22, '#c47a2c');
    vb.box(-0.6, 0.6, 0.3, 0.6, 0.1, 0.6, '#3d7ea6');
    vb.box(0, 2.0, 0, 0.3, 0.3, 0.3, 'lamp');
  } },
  warung: { label: 'Warung', w: 3, d: 3, build(vb, b, ex) {
    vb.box(0, 0, -0.3, 2.6, 2.1, 1.8, '#c9935b');
    vb.box(0, 0, 0.75, 2.6, 0.9, 0.5, '#8a5a32');
    for (let i = 0; i < 6; i++) vb.box(-1.1 + i * 0.44, 2.1, 0.5, 0.44, 0.12, 1.6, i % 2 ? '#ffffff' : '#e63946');
    vb.box(0, 2.1, -0.3, 2.9, 0.3, 2, '#8e3b2e');
    vb.box(0, 0, 1.6, 2.2, 0.45, 0.45, '#6b4a2a');
    for (let i = 0; i < 4; i++) vb.box(-0.9 + i * 0.6, 0.9, 0.75, 0.25, 0.3, 0.25, ['#ffd166', '#06d6a0', '#ef476f', '#118ab2'][i]);
    vb.box(0, 1.6, 0.62, 0.3, 0.3, 0.3, 'lamp');
    const sg = signMesh('KOPI', 1.4, 0.45, '#3d2a1e', '#ffd166'); sg.position.set(0, 2.55, 0.61); ex.push(sg);
  } },
  perumahan: { label: 'Perumahan', w: 10, d: 12, build(vb, b, ex, r) {
    const pos = [[-2.6, -4], [2.6, -4], [-2.6, 0], [2.6, 0], [-2.6, 4], [2.6, 4]];
    const n = Math.max(1, Math.min(6, b.jumlah || 6));
    for (let i = 0; i < n; i++) rumah(vb, pos[i][0], pos[i][1], PALET_RUMAH[Math.floor(r() * PALET_RUMAH.length)], r);
    vb.box(0, 0, 0, 0.9, 0.05, 11.5, '#cfc6b4');
    for (const [x, z] of [[-4.6, 5.6], [4.6, -5.6]]) pohon(vb, x, z, r);
  } },
  pasar: { label: 'Pasar', w: 12, d: 10, build(vb, b, ex, r) {
    vb.box(0, 0, 0, 12, 0.15, 10, '#cfc6b4');
    vb.box(0, 0.15, -2.5, 11, 3.2, 4, '#f2e6cf');
    vb.box(0, 3.35, -2.5, 11.6, 0.4, 4.6, '#2f6f91').box(0, 3.75, -2.5, 10, 0.5, 3, '#3a86b0').box(0, 4.25, -2.5, 7, 0.5, 1.2, '#2f6f91');
    for (const x of [-4, -2, 0, 2, 4]) vb.box(x, 0.15, -0.49, 1.3, 2.2, 0.06, '#4a3426');
    const sg = signMesh('PASAR KOTA', 4.2, 0.8, '#ffffff', '#2f6f91'); sg.position.set(0, 2.75, -0.45); ex.push(sg);
    const atap = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8d5a97'];
    for (let i = 0; i < 4; i++) {
      const x = -4.2 + i * 2.8, z = 2.6;
      for (const sx of [-1, 1]) for (const sz of [-0.8, 0.8]) vb.box(x + sx * 1.05, 0.15, z + sz, 0.12, 1.9, 0.12, '#6b4a2a');
      vb.box(x, 0.15, z + 0.3, 2.2, 0.8, 1, '#a0703f');
      for (let k = 0; k < 6; k++) vb.box(x - 0.9 + (k % 3) * 0.9, 1.0 + Math.floor(k / 3) * 0.05, z + 0.05 + Math.floor(k / 3) * 0.4, 0.6, 0.22, 0.35, ['#d62828', '#f77f00', '#90be6d', '#ffd166', '#c0c0c0'][Math.floor(r() * 5)]);
      for (let k = 0; k < 4; k++) vb.box(x - 0.825 + k * 0.55, 2.05, z, 0.55, 0.18, 2, k % 2 ? '#ffffff' : atap[i]);
    }
  } },
  tambak: { label: 'Tambak', w: 14, d: 6, build(vb, b, ex, r) {
    vb.box(0, 0, 0, 14, 0.35, 6, '#8b6b4a');
    for (const x of [-4.6, 0, 4.6]) vb.box(x, 0.05, 0, 4.1, 0.25, 5.2, 'tambak');
    // kincir air
    for (const x of [-4.6, 4.6]) { vb.box(x, 0.3, 0.8, 0.3, 0.3, 0.9, '#e9c46a'); vb.box(x, 0.2, 0.8, 1.0, 0.3, 0.12, '#ffd166'); }
    // gubuk jaga
    vb.box(2, 0.35, -1.6, 0.15, 1.4, 0.15, '#6b4a2a').box(3, 0.35, -1.6, 0.15, 1.4, 0.15, '#6b4a2a');
    vb.box(2.5, 1.2, -1.6, 1.4, 0.15, 1.1, '#a0703f').box(2.5, 1.9, -1.6, 1.7, 0.25, 1.4, '#8a6d3b').box(2.5, 2.15, -1.6, 0.9, 0.25, 0.8, '#9b7b45');
    // ikan bandeng muncul
    for (let i = 0; i < 6; i++) vb.box(-6 + r() * 12, 0.31, -2 + r() * 4, 0.35, 0.06, 0.12, '#cfd8dc');
  } },
  sawah: { label: 'Sawah', w: 10, d: 12, build(vb, b, ex, r) {
    vb.box(0, 0, 0, 10, 0.18, 12, '#7a5a34');
    for (let x = -4.4; x <= 4.4; x += 0.8) for (let z = -5.4; z <= 5.4; z += 0.8) {
      if (Math.abs(z) < 0.5) continue;
      vb.box(x, 0.18, z, 0.32, 0.35 + r() * 0.3, 0.32, r() < 0.5 ? '#9acd32' : '#7cb342');
    }
    vb.box(0, 0.18, 0, 10, 0.06, 0.7, '#a1855c');
    // orang-orangan sawah
    vb.box(-3, 0.2, 3, 0.15, 1.6, 0.15, '#6b4a2a').box(-3, 1.2, 3, 1.2, 0.12, 0.12, '#6b4a2a').box(-3, 1.0, 3, 0.5, 0.6, 0.3, '#e63946').box(-3, 1.6, 3, 0.4, 0.4, 0.4, '#f1c27d').box(-3, 2.0, 3, 0.9, 0.12, 0.9, '#d4a64a');
    // saung
    for (const x of [2.6, 4]) for (const z of [-4.2, -3]) vb.box(x, 0.18, z, 0.15, 1.3, 0.15, '#6b4a2a');
    vb.box(3.3, 0.7, -3.6, 1.6, 0.12, 1.4, '#a0703f').box(3.3, 1.45, -3.6, 1.9, 0.25, 1.7, '#8a6d3b').box(3.3, 1.7, -3.6, 1.0, 0.25, 0.9, '#9b7b45');
  } },
  candi: { label: 'Candi', w: 8, d: 8, build(vb) {
    const bata = '#a4462f', gelap = '#7f3424';
    vb.box(0, 0, 0, 7.4, 0.8, 7.4, bata).box(0, 0.8, 0, 6.2, 1.0, 6.2, gelap).box(0, 1.8, 0, 4.6, 2.6, 4.6, bata);
    vb.box(0, 0, 3.9, 1.6, 0.8, 1.2, gelap).box(0, 0.8, 3.4, 1.4, 1.0, 1.0, bata).box(0, 1.8, 2.31, 1.1, 1.6, 0.08, '#3b1a12');
    vb.box(0, 4.4, 0, 5.0, 0.5, 5.0, gelap).box(0, 4.9, 0, 4.0, 0.8, 4.0, bata).box(0, 5.7, 0, 3.0, 0.8, 3.0, gelap).box(0, 6.5, 0, 2.0, 0.8, 2.0, bata).box(0, 7.3, 0, 1.0, 0.7, 1.0, gelap).box(0, 8.0, 0, 0.45, 0.8, 0.45, bata);
    for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) vb.box(x, 4.9, z, 0.6, 1, 0.6, bata);
    for (const [x, z] of [[-3.4, -3.4], [3.4, 3.4], [-3.4, 3.4], [3.4, -3.4]]) vb.box(x, 0, z, 0.6, 0.9, 0.6, '#5c6b52');
  } },
  sekolah: { label: 'Sekolah', w: 10, d: 7, build(vb, b, ex) {
    vb.box(0, 0, 0, 10, 0.12, 7, '#cfc6b4');
    vb.box(0, 0.12, -1.6, 9.4, 3, 3.4, '#f4ecd8');
    vb.box(0, 0.12, -1.6, 9.6, 0.5, 3.6, '#c44536');
    vb.box(0, 3.12, -1.6, 10, 0.4, 4.2, '#c44536').box(0, 3.52, -1.6, 8.6, 0.45, 2.8, '#a63a2e').box(0, 3.97, -1.6, 6.8, 0.4, 1.4, '#c44536');
    for (const x of [-3.6, -1.8, 0, 1.8, 3.6]) vb.box(x, 1.3, 0.11, 1.1, 1.0, 0.06, 'win');
    vb.box(0, 0.12, 0.12, 1, 1.9, 0.08, '#6d4527');
    vb.box(0, 0.12, 2.4, 0.12, 4.2, 0.12, '#dddddd').box(0.55, 3.7, 2.4, 0.9, 0.3, 0.04, '#e63946').box(0.55, 3.4, 2.4, 0.9, 0.3, 0.04, '#ffffff');
    const sg = signMesh('SD SIDOARJOVERSE', 4, 0.5, '#ffffff', '#c44536'); sg.position.set(0, 2.6, 0.13); ex.push(sg);
  } },
  puskesmas: { label: 'Puskesmas', w: 8, d: 6, build(vb) {
    vb.box(0, 0, 0, 8, 0.12, 6, '#cfc6b4');
    vb.box(0, 0.12, -0.8, 7.2, 2.8, 3.6, '#fbfbfb');
    vb.box(0, 2.92, -0.8, 7.6, 0.35, 4, '#2a9d8f').box(0, 3.27, -0.8, 6, 0.35, 2.6, '#268c80');
    for (const x of [-2.6, -1.3, 1.3, 2.6]) vb.box(x, 1.2, 1.01, 0.9, 0.9, 0.06, 'win');
    vb.box(0, 0.12, 1.02, 1.2, 1.9, 0.06, '#9fd3c7');
    vb.box(0, 2.15, 1.04, 0.9, 0.6, 0.06, '#ffffff').box(0, 2.3, 1.08, 0.6, 0.18, 0.04, '#e63946').box(0, 2.15, 1.08, 0.18, 0.5, 0.04, '#e63946');
    vb.box(0, 0.12, 1.9, 2.8, 0.06, 1.6, '#e0dbd0');
    vb.box(-2.6, 0.12, 2.1, 2.2, 1.0, 1.1, '#ffffff').box(-2.0, 1.12, 2.1, 1.0, 0.5, 1.0, '#ffffff').box(-3.0, 0.7, 2.66, 0.5, 0.2, 0.02, '#e63946');
  } },
  tugu: { label: 'Tugu', w: 6, d: 6, build(vb) {
    vb.box(0, 0, 0, 6, 0.15, 6, '#d9cbb0').box(0, 0.15, 0, 4, 0.5, 4, '#e8e2d4').box(0, 0.65, 0, 2.8, 0.6, 2.8, '#d6cfbf').box(0, 1.25, 0, 1.6, 1.4, 1.6, '#e8e2d4');
    vb.box(0, 2.65, 0, 1.0, 6.5, 1.0, '#f5f1e6').box(0, 5.0, 0, 1.16, 0.4, 1.16, '#2a9d8f').box(0, 9.15, 0, 1.3, 0.3, 1.3, '#e6b422').box(0, 9.45, 0, 0.6, 1, 0.6, '#e6b422');
    for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) vb.box(x, 0.15, z, 0.6, 0.5, 0.6, '#5aa65a');
  } },
  lapangan: { label: 'Lapangan', w: 12, d: 8, build(vb) {
    vb.box(0, 0, 0, 12, 0.1, 8, '#5fae4f');
    vb.box(0, 0.1, 0, 11, 0.02, 0.08, '#fff').box(0, 0.1, 3.5, 11, 0.02, 0.08, '#fff').box(0, 0.1, -3.5, 11, 0.02, 0.08, '#fff');
    vb.box(-5.5, 0.1, 0, 0.08, 0.02, 7, '#fff').box(5.5, 0.1, 0, 0.08, 0.02, 7, '#fff').box(0, 0.1, 0, 0.08, 0.02, 7, '#fff');
    for (const s of [-1, 1]) { vb.box(s * 5.5, 0.1, -1, 0.12, 1.2, 0.12, '#fff').box(s * 5.5, 0.1, 1, 0.12, 1.2, 0.12, '#fff').box(s * 5.5, 1.3, 0, 0.12, 0.12, 2.12, '#fff'); }
  } },
  rumah: { label: 'Rumah', w: 4, d: 4, build(vb, b, ex, r) { rumah(vb, 0, 0, PALET_RUMAH[Math.floor(r() * PALET_RUMAH.length)], r); } },
  kantor: { label: 'Gedung', w: 8, d: 6, build(vb) {
    vb.box(0, 0, 0, 8, 0.12, 6, '#cfc6b4');
    vb.box(0, 0.12, -0.5, 6.4, 6, 4, '#e9edf2');
    for (let y = 1; y < 6; y += 1.2) for (const x of [-2.2, -0.75, 0.75, 2.2]) vb.box(x, y, 1.51, 1, 0.7, 0.06, 'win');
    vb.box(0, 6.12, -0.5, 6.8, 0.4, 4.4, '#0f4c5c');
    vb.box(0, 0.12, 1.55, 1.4, 1.6, 0.06, '#0f4c5c');
  } },
};

// ---------------------------------------------------------------- papan pengumuman
export const PAPAN_BAWAAN = {
  tampil: true, judul: 'PENGUMUMAN', x: 2.9, z: -2.9, rot: 45,
  isi: 'Selamat datang di SidoarjoVerse!\nFollow = jadi warga\nKomen like terbanyak = besok dibangun\nBikin KTP-mu di tab KTP',
};
function bungkus(ctx, teks, maks) {   // pecah teks jadi baris yang muat
  const hasil = [];
  for (const par of String(teks || '').split('\n')) {
    let baris = '';
    for (const k of par.split(' ')) { const coba = baris ? baris + ' ' + k : k; if (ctx.measureText(coba).width > maks && baris) { hasil.push(baris); baris = k; } else baris = coba; }
    hasil.push(baris);
  }
  return hasil;
}
function buatPapan(pp) {
  const g = new THREE.Group();
  const kayu = mat('#8a6440'), kayuGelap = mat('#6e4e31');
  for (const x of [-1.15, 1.15]) { const t = new THREE.Mesh(UNIT, kayuGelap); t.scale.set(0.16, 2.7, 0.16); t.position.set(x, 1.35, 0); t.castShadow = true; g.add(t); }
  const bingkai = new THREE.Mesh(UNIT, kayu); bingkai.scale.set(2.5, 1.7, 0.14); bingkai.position.set(0, 1.75, 0); bingkai.castShadow = true; g.add(bingkai);
  const atap = new THREE.Mesh(UNIT, kayuGelap); atap.scale.set(2.8, 0.14, 0.42); atap.position.set(0, 2.68, 0.04); atap.castShadow = true; g.add(atap);
  // kertas pengumuman (tekstur dari teks admin)
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 680;
  const c = cv.getContext('2d');
  c.fillStyle = '#fbf6ea'; c.fillRect(0, 0, 1024, 680);
  c.fillStyle = '#0f4c5c'; c.fillRect(0, 0, 1024, 150);
  c.fillStyle = '#ffd166'; c.font = '900 76px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  let j = String(pp.judul || 'PENGUMUMAN').toUpperCase(), fs = 76;
  while (c.measureText(j).width > 940 && fs > 30) { fs -= 4; c.font = `900 ${fs}px system-ui, sans-serif`; }
  c.fillText(j, 512, 80);
  c.fillStyle = '#16324f'; c.textAlign = 'left';
  let isi = 48; c.font = `700 ${isi}px system-ui, sans-serif`;
  let baris = bungkus(c, pp.isi, 920);
  while (baris.length * isi * 1.3 > 480 && isi > 22) { isi -= 2; c.font = `700 ${isi}px system-ui, sans-serif`; baris = bungkus(c, pp.isi, 920); }
  baris.forEach((t, i) => c.fillText(t, 52, 210 + i * isi * 1.3));
  for (const [x, y] of [[40, 175], [984, 175]]) { c.fillStyle = '#e63946'; c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill(); }
  const kertas = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.53), new THREE.MeshStandardMaterial({ map: canvasTex(cv), roughness: 0.9 }));
  kertas.position.set(0, 1.75, 0.075); g.add(kertas);
  const belakang = kertas.clone(); belakang.rotation.y = Math.PI; belakang.position.z = -0.075; g.add(belakang);
  return g;
}

// ---------------------------------------------------------------- karakter
// ---- gaya "figur premium": kepala bulat, badan tegap bersudut bulat, kaki jenjang, wajah minimalis ekspresif, material matte
const GEO = {
  bola: new THREE.SphereGeometry(0.5, 32, 24),
  bolaKecil: new THREE.SphereGeometry(0.5, 16, 12),
  kapsul: new THREE.CapsuleGeometry(0.5, 1, 8, 16),
  tabung: new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
  badan: new RoundedBoxGeometry(1, 1, 1, 5, 0.18),
};
const MATS_HALUS = new Map();
function matHalus(c) { // material matte (doff) untuk karakter
  let m = MATS_HALUS.get(c);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0 }); MATS_HALUS.set(c, m); }
  return m;
}
// Ekspresi: mata, alis, mulut (+ keringat). Nama yang hanya mengubah mulut: diam, buka, senyum, o.
export const EKSPRESI = {
  normal:  { mata: 'normal', alis: [0, 0], mulut: 'senyum' },
  senang:  { mata: 'tutup',  alis: [0.045, 0.045], mulut: 'tawa', merona: true },
  nyengir: { mata: 'normal', alis: [0.03, 0.03], mulut: 'nyengir' },
  skeptis: { mata: 'lirik',  alis: [0.08, -0.03], mulut: 'datar', miring: 0.35 },
  marah:   { mata: 'normal', alis: [-0.045, -0.045], mulut: 'cemberut', alisSudut: -0.6 },
  sedih:   { mata: 'normal', alis: [0.03, 0.03], mulut: 'cemberut', alisSudut: 0.5 },
  kaget:   { mata: 'besar',  alis: [0.085, 0.085], mulut: 'o' },
  bosan:   { mata: 'garis',  alis: [-0.01, -0.01], mulut: 'datar' },
  panik:   { mata: 'besar',  alis: [0.05, 0.05], mulut: 'buka', alisSudut: 0.45, keringat: true },
  tidur:   { mata: 'garis',  alis: [-0.015, -0.015], mulut: 'o' },
};
const HANYA_MULUT = new Set(['diam', 'buka', 'senyum', 'o']);   // untuk gerak bibir saat bicara
// ---- bentuk mulut ekspresif (bidang datar ditempel ke wajah)
const _matMulut = {};
const mm = c => _matMulut[c] || (_matMulut[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
function mulutTawa(r) {          // tertawa: rongga mulut + gigi atas + lidah
  const g = new THREE.Group();
  const rongga = new THREE.Mesh(new THREE.CircleGeometry(r, 28, Math.PI, Math.PI), mm('#3a1212')); g.add(rongga);
  const gigi = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.62, r * 0.36), mm('#fbfaf6')); gigi.position.set(0, -r * 0.2, 0.002); g.add(gigi);
  const lidah = new THREE.Mesh(new THREE.CircleGeometry(r * 0.48, 20, 0, Math.PI), mm('#e36f78')); lidah.position.set(0, -r * 0.98, 0.003); g.add(lidah);
  const atas = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.04, r * 0.08), mm('#3a1212')); atas.position.set(0, 0, 0.004); g.add(atas);
  return g;
}
function mulutNyengir() {        // nyengir: senyum lebar memperlihatkan gigi
  const g = new THREE.Group(), w = 0.21, h = 0.085;
  const luar = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mm('#3a1212')); luar.scale.set(w / 2, h / 2, 1); g.add(luar);
  const gigi = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mm('#fbfaf6')); gigi.scale.set(w / 2 - 0.008, h / 2 - 0.009, 1); gigi.position.z = 0.002; g.add(gigi);
  const garis = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, 0.005), mm('#c9c4ba')); garis.position.z = 0.004; g.add(garis);
  return g;
}
function mulutBuka() {           // bicara: mulut terbuka + gigi atas + lidah
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.CircleGeometry(1, 24), mm('#3a1212')); r.scale.set(0.05, 0.04, 1); g.add(r);
  const gigi = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.014), mm('#fbfaf6')); gigi.position.set(0, 0.024, 0.002); g.add(gigi);
  const lidah = new THREE.Mesh(new THREE.CircleGeometry(0.024, 16, 0, Math.PI), mm('#e36f78')); lidah.position.set(0, -0.036, 0.003); g.add(lidah);
  return g;
}
function makeChar(look, opt = {}) {
  const g = new THREE.Group();
  const M = matHalus;
  const mesh = (geo, c, sx, sy, sz, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, typeof c === 'string' ? M(c) : c); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const baju = opt.baju || look.baju, celana = opt.celana || look.celana;
  const kain = opt.batik ? matBatik(opt.batik) : baju;
  const legs = [], arms = [];
  // kaki jenjang + sepatu sneakers
  for (const s of [-0.14, 0.14]) {
    const p = new THREE.Group(); p.position.set(s, 0.92, 0); g.add(p);
    mesh(GEO.kapsul, celana, 0.23, 0.35, 0.24, 0, -0.42, 0, p);
    mesh(GEO.bolaKecil, '#f3f1ec', 0.21, 0.13, 0.32, 0, -0.86, 0.05, p);
    mesh(GEO.bolaKecil, '#cfcac0', 0.215, 0.04, 0.325, 0, -0.91, 0.05, p);
    legs.push(p);
  }
  // badan tegap bersudut bulat
  mesh(GEO.badan, kain, 0.62, 0.82, 0.38, 0, 1.3, 0);
  if (opt.kaos) {   // kemeja terbuka: kaos di dalam terlihat, kerah + kancing di tepi kemeja
    const kaos = mesh(GEO.badan, opt.kaos, 0.24, 0.8, 0.06, 0, 1.3, 0.172);
    mesh(GEO.tabung, opt.kaos, 0.2, 0.02, 0.1, 0, 1.69, 0.13).rotation.x = Math.PI / 2 - 0.3;      // leher kaos
    const tepi = kain.userData.manset || gelap(baju);
    for (const sx of [-1, 1]) {
      mesh(GEO.badan, kain, 0.05, 0.8, 0.05, sx * 0.135, 1.3, 0.19);                              // tepi kemeja (plaket)
      const kr = mesh(GEO.badan, kain, 0.17, 0.13, 0.04, sx * 0.13, 1.64, 0.2); kr.rotation.set(-0.25, 0, sx * 0.55);  // kerah
      mesh(GEO.badan, tepi, 0.012, 0.8, 0.052, sx * 0.112, 1.3, 0.192);                             // garis jahitan
    }
    for (const y of [1.5, 1.32, 1.14, 0.97]) mesh(GEO.bolaKecil, '#f4ecd8', 0.028, 0.028, 0.015, -0.135, y, 0.217);   // kancing
  }
  if (opt.rompi) {   // rompi proyek: warna terang + 2 garis reflektif, bagian depan terbuka
    for (const sx of [-1, 1]) mesh(GEO.badan, opt.rompi, 0.27, 0.66, 0.41, sx * 0.175, 1.33, 0);
    mesh(GEO.badan, opt.rompi, 0.62, 0.66, 0.2, 0, 1.33, -0.105);
    for (const y of [1.18, 1.42]) for (const sx of [-1, 1]) mesh(GEO.badan, '#e8eef2', 0.275, 0.055, 0.415, sx * 0.175, y, 0);
  }
  if (opt.selempang) { // selempang diagonal menempel di badan
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 48), M(opt.selempang));
    t.rotation.order = 'ZYX'; t.rotation.set(0, Math.PI / 2, 0.9); t.scale.set(0.5, 1.0, 0.93); t.position.set(0, 1.32, 0); g.add(t);
  }
  if (!opt.akuarium && !opt.batik) for (const y of [1.45, 1.25, 1.05]) mesh(GEO.bolaKecil, '#ffffff', 0.04, 0.04, 0.02, 0, y, 0.225);
  mesh(GEO.tabung, look.kulit, 0.17, 0.12, 0.17, 0, 1.73, 0);                          // leher
  // lengan + tangan
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * 0.38, 1.6, 0); g.add(p);
    mesh(GEO.kapsul, kain, 0.16, 0.3, 0.16, 0, -0.32, 0, p);
    mesh(GEO.bola, look.kulit, 0.15, 0.17, 0.15, 0, -0.7, 0, p);
    if (opt.batik) mesh(GEO.tabung, kain.userData.manset, 0.165, 0.04, 0.165, 0, -0.6, 0, p);   // manset lengan panjang
    if (opt.tongkat && s < 0) {   // tongkat komando di tangan kiri
      const tk = new THREE.Group(); tk.position.set(0, -0.72, 0.03); tk.rotation.set(1.15, 0, 0.12); p.add(tk);
      mesh(GEO.tabung, '#2a2320', 0.045, 0.62, 0.045, 0, 0.12, 0, tk);
      mesh(GEO.bola, '#d9a81e', 0.07, 0.07, 0.07, 0, 0.44, 0, tk);
      mesh(GEO.tabung, '#d9a81e', 0.05, 0.06, 0.05, 0, -0.2, 0, tk);
      mesh(GEO.tabung, '#d9a81e', 0.052, 0.02, 0.052, 0, 0.3, 0, tk);
    }
    if (opt.jam && s < 0) {
      mesh(GEO.tabung, '#5a3a22', 0.17, 0.05, 0.17, 0, -0.56, 0, p);
      const mk = mesh(GEO.tabung, '#d9a81e', 0.07, 0.03, 0.07, 0, -0.56, 0.085, p); mk.rotation.x = Math.PI / 2;
      mesh(GEO.tabung, '#fffaf0', 0.05, 0.032, 0.05, 0, -0.56, 0.088, p).rotation.x = Math.PI / 2;
    }
    arms.push(p);
  }
  // kepala bulat (sedikit lonjong)
  const RX = 0.44, RY = 0.46, RZ = 0.43;
  const head = new THREE.Group(); head.position.set(0, 2.16, 0); g.add(head);
  mesh(GEO.bola, look.kulit, RX * 2, RY * 2, RZ * 2, 0, 0, 0, head);
  for (const s of [-1, 1]) mesh(GEO.bolaKecil, look.kulit, 0.1, 0.16, 0.08, s * RX, -0.02, -0.01, head);   // telinga
  if (look.kerudung) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.84), M(look.kerudung));
    k.scale.set(RX * 2.1, RY * 2.08, RZ * 2.1); k.castShadow = true; head.add(k);
    mesh(GEO.bola, look.kerudung, 0.82, 0.5, 0.7, 0, -0.42, -0.04, head);
  } else {
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24, 0, Math.PI * 2, 0, opt.peci ? 1.2 : 1.12), M(look.rambut));
    r.rotation.x = -0.36; r.scale.set(RX * 2.06, RY * 2.04, RZ * 2.08); r.castShadow = true; head.add(r);
    if (opt.gaya === 'genz') {
      // potongan "textured crop": rambut menutup dahi atas, poni berlapis rapi, sisi tipis
      r.geometry = new THREE.SphereGeometry(0.5, 32, 24, 0, Math.PI * 2, 0, 1.32);
      r.rotation.x = -0.12; r.scale.set(RX * 2.1, RY * 2.12, RZ * 2.12); r.position.y = 0.02;
      const helai = [[-0.25, 0.27, 0.3, 0.5], [-0.12, 0.3, 0.36, 0.25], [0.02, 0.31, 0.38, 0.0], [0.15, 0.3, 0.36, -0.25], [0.27, 0.27, 0.3, -0.45]];
      for (const [x, y, z, rz] of helai) {
        const h = mesh(GEO.bola, look.rambut, 0.17, 0.2, 0.13, x, y, z, head); h.rotation.set(0.85, 0, rz);
      }
      mesh(GEO.bola, look.rambut, 0.62, 0.26, 0.56, 0.02, 0.36, 0.0, head);                   // volume atas
      for (const s of [-1, 1]) mesh(GEO.bolaKecil, look.rambut, 0.05, 0.13, 0.07, s * (RX - 0.02), 0.06, 0.13, head); // cambang tipis
    }
    if (look.rambutPanjang) mesh(GEO.bola, look.rambut, 0.84, 0.92, 0.55, 0, -0.14, -0.18, head);
  }
  if (opt.helm) {   // helm proyek (tukang)
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), M(opt.helm));
    hm.scale.set(RX * 2.15, RY * 1.9, RZ * 2.15); hm.position.y = 0.06; hm.castShadow = true; head.add(hm);
    mesh(GEO.tabung, opt.helm, RX * 2.45, 0.03, RZ * 2.45, 0, 0.07, 0.0, head);              // pinggiran helm
    mesh(GEO.tabung, opt.helm, RX * 1.5, 0.028, RZ * 1.2, 0, 0.075, RZ * 1.05, head);        // lidah depan helm
    mesh(GEO.badan, opt.helm, 0.05, 0.06, RZ * 1.9, 0, RY * 0.93 + 0.06, 0, head);           // rusuk tengah helm
  }
  if (opt.peci) {
    const pc = mesh(GEO.tabung, '#151515', 0.6, 0.2, 0.52, 0, 0.42, -0.03, head); pc.rotation.x = -0.12;
    const pb = mesh(GEO.tabung, '#3a3a3a', 0.605, 0.025, 0.525, 0, 0.335, -0.02, head); pb.rotation.x = -0.12;
  }
  // wajah minimalis: setiap fitur ditempel di permukaan kepala
  const muka = new THREE.Group(); head.add(muka);
  const zs = (x, y, off = 0) => RZ * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2 - (y / RY) ** 2)) + off;
  const HIT = '#1b1b1b';
  const Z = new THREE.Vector3(0, 0, 1);
  const tempel = (m, x, y, off) => { m.position.set(x, y, zs(x, y, off)); const n = new THREE.Vector3(x / RX ** 2, y / RY ** 2, zs(x, y) / RZ ** 2).normalize(); m.quaternion.setFromUnitVectors(Z, n); return m; };
  const mataSet = { normal: [], besar: [], tutup: [], garis: [], lirik: [] };
  const alis = [];
  for (const s of [-1, 1]) {
    const x = s * 0.14, y = 0.02;
    const n = tempel(mesh(GEO.bolaKecil, HIT, 0.085, 0.11, 0.04, 0, 0, 0, muka), x, y, -0.006);
    const kn = tempel(mesh(GEO.bolaKecil, '#ffffff', 0.028, 0.03, 0.015, 0, 0, 0, muka), x + 0.018, y + 0.025, 0.012);
    mataSet.normal.push(n, kn);
    mataSet.besar.push(tempel(mesh(GEO.bolaKecil, HIT, 0.12, 0.14, 0.045, 0, 0, 0, muka), x, y + 0.01, -0.006),
      tempel(mesh(GEO.bolaKecil, '#ffffff', 0.035, 0.038, 0.015, 0, 0, 0, muka), x + 0.025, y + 0.045, 0.014));
    const tt = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 14, Math.PI), M(HIT)); muka.add(tempel(tt, x, y - 0.015, 0.004)); tt.rotateZ(0);
    mataSet.tutup.push(tt);
    const gr = tempel(mesh(GEO.kapsul, HIT, 0.022, 0.035, 0.02, 0, 0, 0, muka), x, y, 0.002); gr.rotateZ(Math.PI / 2); mataSet.garis.push(gr);
    mataSet.lirik.push(tempel(mesh(GEO.bolaKecil, HIT, 0.08, 0.075, 0.04, 0, 0, 0, muka), x + 0.035, y - 0.005, -0.006));
    const al = tempel(mesh(GEO.kapsul, opt.peci || !look.rambut ? '#1a1a1a' : look.rambut, 0.03, 0.055, 0.024, 0, 0, 0, muka), x, 0.16, 0.0);
    al.rotateZ(Math.PI / 2); al.userData.dasar = { x, y: 0.16, s }; alis.push(al);
  }
  tempel(mesh(GEO.bolaKecil, gelap(look.kulit), 0.06, 0.05, 0.05, 0, 0, 0, muka), 0, -0.07, -0.012);     // hidung
  const yM = (look.kumis || opt.kumis) ? -0.2 : -0.16;
  if (look.kumis || opt.kumis) for (const s of [-1, 1]) { const k = tempel(mesh(GEO.kapsul, '#2a1a10', 0.04, 0.05, 0.035, 0, 0, 0, muka), s * 0.065, -0.135, -0.004); k.rotateZ(Math.PI / 2 + s * 0.3); }
  if (look.kacamata) {
    const bingkai = M('#2b2622'), lensa = new THREE.MeshStandardMaterial({ color: '#dff1f7', roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false });
    for (const s of [-1, 1]) {
      muka.add(tempel(new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.012, 8, 28), bingkai), s * 0.145, 0.025, 0.03));
      muka.add(tempel(new THREE.Mesh(new THREE.CircleGeometry(0.094, 28), lensa), s * 0.145, 0.025, 0.026));
      const tg = mesh(GEO.kapsul, '#2b2622', 0.016, 0.16, 0.016, s * (RX - 0.02), 0.03, 0.12, head); tg.rotation.x = Math.PI / 2;   // gagang
    }
    const jb = tempel(mesh(GEO.kapsul, '#2b2622', 0.014, 0.022, 0.014, 0, 0, 0, muka), 0, 0.045, 0.034); jb.rotateZ(Math.PI / 2); // jembatan
  }
  const MR = '#5a1f1f';
  const mulut = {
    diam: tempel(mesh(GEO.kapsul, MR, 0.018, 0.03, 0.015, 0, 0, 0, muka), 0, yM, -0.002),
    datar: tempel(mesh(GEO.kapsul, MR, 0.016, 0.05, 0.014, 0, 0, 0, muka), 0.02, yM, -0.002),
    buka: tempel(mesh(GEO.bolaKecil, '#3d1212', 0.1, 0.08, 0.04, 0, 0, 0, muka), 0, yM - 0.01, -0.01),
    o: tempel(mesh(GEO.bolaKecil, '#3d1212', 0.05, 0.06, 0.03, 0, 0, 0, muka), 0, yM - 0.005, -0.008),
    senyum: tempel(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 18, Math.PI), M(MR)), 0, yM + 0.025, -0.006),
    cemberut: tempel(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.013, 6, 18, Math.PI), M(MR)), 0, yM - 0.03, -0.006),
    tawa: tempel(mulutTawa(0.1), 0, yM + 0.015, 0.004),
    nyengir: tempel(mulutNyengir(), 0, yM + 0.005, 0.004),
  };
  // mulut bicara: diganti versi dengan gigi atas agar lebih hidup
  muka.remove(mulut.buka); mulut.buka = tempel(mulutBuka(), 0, yM - 0.005, 0.004);
  mulut.diam.rotateZ(Math.PI / 2); mulut.datar.rotateZ(Math.PI / 2 + 0.12);
  mulut.senyum.rotateZ(Math.PI); muka.add(mulut.senyum, mulut.cemberut, mulut.tawa, mulut.nyengir, mulut.buka);
  const merona = []; for (const s of [-1, 1]) merona.push(tempel(mesh(GEO.bolaKecil, '#f1958f', 0.1, 0.05, 0.02, 0, 0, 0, muka), s * 0.25, -0.1, -0.008));
  // keringat (panik)
  const keringat = new THREE.Group();
  const tetes = new THREE.Mesh(GEO.bolaKecil, new THREE.MeshStandardMaterial({ color: '#7fd0ff', roughness: 0.2, transparent: true, opacity: 0.9 }));
  tetes.scale.set(0.07, 0.09, 0.05); keringat.add(tetes);
  const ujung = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 10), tetes.material); ujung.position.y = 0.06; keringat.add(ujung);
  keringat.position.set(RX * 0.82, 0.22, RZ * 0.45); keringat.visible = false; head.add(keringat);
  let kini = opt.ekspresiAwal || 'normal';
  const setMulut = m => { for (const [k, x] of Object.entries(mulut)) x.visible = k === m; };
  function terapkan(nama) {
    const e = EKSPRESI[nama] || EKSPRESI.normal; kini = nama in EKSPRESI ? nama : 'normal';
    for (const [k, l] of Object.entries(mataSet)) for (const m of l) m.visible = k === e.mata;
    alis.forEach((al, i) => {
      const d = al.userData.dasar, naik = e.alis[i] || 0;
      tempel(al, d.x, d.y + naik, 0.0); al.rotateZ(Math.PI / 2 + (e.alisSudut || 0) * d.s * -1 + (e.miring && i === 0 ? e.miring : 0));
    });
    setMulut(e.mulut); keringat.visible = !!e.keringat; merona.forEach(m => { m.visible = !!e.merona; });
  }
  terapkan(kini);
  head.castShadow = true;
  g.userData.anim = { legs, arms, head };
  // ekspresi(nama): nama ekspresi penuh (EKSPRESI) atau hanya mulut (diam/buka/senyum/o) untuk gerak bibir
  g.userData.ekspresi = m => { if (HANYA_MULUT.has(m)) setMulut(m); else terapkan(m); };
  g.userData.ekspresiKini = () => kini;
  if (opt.akuarium) {
    arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.set(-0.78, 0, -s * 0.42); });
    g.userData.anim.arms = [new THREE.Object3D(), new THREE.Object3D()];
    const ak = buatAkuarium();
    ak.group.scale.setScalar(0.92);
    ak.group.position.set(0, 1.08, 0.6);
    g.add(ak.group);
    g.userData.tick = ak.tick;
  }
  return g;
}
// Batik khas SidoarjoVerse: motif udang & bandeng di atas teal (dibuat dari kode, tanpa gambar luar)
// Palet batik: dasar, garis, motif bandeng, motif udang, titik
export const PALET_BATIK = {
  sage:   ['#b7cdbf', 'rgba(70,100,85,.22)', '#fffaf0', '#d9825b', 'rgba(255,250,240,.8)'],
  lilac:  ['#c9bddb', 'rgba(90,70,120,.2)', '#fffaf0', '#d97b8f', 'rgba(255,250,240,.8)'],
  biru:   ['#a9c3d8', 'rgba(50,80,110,.2)', '#fffaf0', '#e08a5f', 'rgba(255,250,240,.8)'],
  navy:   ['#2f3f5c', 'rgba(255,255,255,.08)', '#f4ecd8', '#f2a65a', 'rgba(244,236,216,.6)'],
  teal:   ['#0f7c8c', 'rgba(8,70,80,.3)', '#f4ecd8', '#f28c28', 'rgba(244,236,216,.75)'],
};
const _batik = {};
function matBatik(nama = 'teal') {
  if (nama === true) nama = 'teal';
  if (_batik[nama]) return _batik[nama];
  const [DASAR, GARIS, BANDENG, UDANG, TITIK] = PALET_BATIK[nama] || PALET_BATIK.teal;
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const c = cv.getContext('2d');
  c.fillStyle = DASAR; c.fillRect(0, 0, N, N);
  // garis lereng tipis (latar)
  c.strokeStyle = GARIS; c.lineWidth = 2;
  for (let i = -N; i < N * 2; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i - N, N); c.stroke(); }
  const bandeng = (x, y, s, rot) => {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.fillStyle = BANDENG; c.beginPath(); c.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-18, 0); c.lineTo(-32, -10); c.lineTo(-28, 0); c.lineTo(-32, 10); c.closePath(); c.fill();
    c.fillStyle = DASAR; c.beginPath(); c.arc(13, -2, 2.2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = DASAR; c.lineWidth = 1.6; for (const k of [-6, 0, 6]) { c.beginPath(); c.arc(k, 0, 5, -1.1, 1.1); c.stroke(); }
    c.restore();
  };
  const udang = (x, y, s, rot) => {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.strokeStyle = UDANG; c.lineCap = 'round';
    c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 13, Math.PI * 0.15, Math.PI * 1.25); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(12, 6); c.quadraticCurveTo(26, 8, 30, -6); c.stroke();
    c.beginPath(); c.moveTo(12, 6); c.quadraticCurveTo(24, 14, 32, 4); c.stroke();
    c.fillStyle = UDANG; c.beginPath(); c.moveTo(-10, -9); c.lineTo(-20, -16); c.lineTo(-16, -4); c.closePath(); c.fill();
    c.restore();
  };
  const sel = N / 3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const x = sel * (i + 0.5) + (j % 2 ? sel / 2 : 0), y = sel * (j + 0.5);
    for (const dx of [0, -N]) { if ((i + j) % 2) udang(x + dx, y, 1.15, 0.4); else bandeng(x + dx, y, 1.15, -0.3); }
  }
  // isen-isen titik
  c.fillStyle = TITIK;
  for (let i = 0; i < 40; i++) { const x = (i * 71) % N, y = (i * 137 + 20) % N; c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
  const tx = canvasTex(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 1.5);
  _batik[nama] = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.85 });
  _batik[nama].userData.manset = gelap(DASAR);
  return _batik[nama];
}
function gelap(hex) { const c = new THREE.Color(hex); c.multiplyScalar(0.86); return '#' + c.getHexString(); }

// Ikon Cak Darjo: akuarium bundar berisi bandeng & udang (khas Kota Delta)
export function buatAkuarium() {
  const grp = new THREE.Group();
  const R = 0.4;
  const kaca = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 2),
    new THREE.MeshPhongMaterial({ color: '#dff6ff', transparent: true, opacity: 0.28, shininess: 120, specular: '#ffffff', depthWrite: false }));
  kaca.renderOrder = 3;
  const air = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.92, 2), new THREE.MeshLambertMaterial({ color: '#46b4e6', transparent: true, opacity: 0.42, depthWrite: false }));
  air.scale.y = 0.78; air.position.y = -0.05; air.renderOrder = 2;
  const bibir = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.035, 6, 16), new THREE.MeshLambertMaterial({ color: '#bfe9f7' }));
  bibir.rotation.x = Math.PI / 2; bibir.position.y = R * 0.83;
  const pasir = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.5, 0.08, 10), new THREE.MeshLambertMaterial({ color: '#ead7a4' }));
  pasir.position.y = -R * 0.8;
  grp.add(pasir, air, bibir, kaca);
  // rumput air
  const hijau = mat('#3fa34d');
  for (const [x, z, h] of [[-0.14, -0.08, 0.22], [-0.09, -0.12, 0.16], [0.15, -0.1, 0.18]]) {
    const r = new THREE.Mesh(UNIT, hijau); r.scale.set(0.03, h, 0.03); r.position.set(x, -R * 0.75 + h / 2, z); grp.add(r);
  }
  // bandeng: badan perak memanjang, punggung kebiruan, ekor bercabang
  const bandeng = new THREE.Group();
  const kotak = (w, h, d, c, x, y, z, p = bandeng) => { const m = new THREE.Mesh(UNIT, mat(c)); m.scale.set(w, h, d); m.position.set(x, y, z); p.add(m); return m; };
  kotak(0.3, 0.085, 0.07, '#d9e2e8', 0, 0, 0);
  kotak(0.26, 0.03, 0.072, '#7f97a8', 0, 0.035, 0);
  kotak(0.06, 0.06, 0.074, '#c7d2da', 0.16, -0.005, 0);
  kotak(0.012, 0.016, 0.076, '#111', 0.175, 0.012, 0);
  const e1 = kotak(0.08, 0.025, 0.02, '#a9b8c3', -0.18, 0.025, 0); e1.rotation.z = 0.55;
  const e2 = kotak(0.08, 0.025, 0.02, '#a9b8c3', -0.18, -0.025, 0); e2.rotation.z = -0.55;
  kotak(0.06, 0.03, 0.01, '#a9b8c3', 0.0, 0.065, 0);
  bandeng.scale.setScalar(0.95);
  grp.add(bandeng);
  // udang kecil: ruas oranye melengkung + sungut
  const udang = new THREE.Group();
  const ruas = ['#ff8a5b', '#ff7a4a', '#ff8a5b', '#ff9b70'];
  ruas.forEach((c, i) => { const m = kotak(0.045, 0.04, 0.04, c, -i * 0.04, -i * i * 0.006, 0, udang); m.rotation.z = -i * 0.25; });
  kotak(0.03, 0.03, 0.05, '#ff7a4a', -0.17, -0.05, 0, udang);
  const s1 = kotak(0.1, 0.006, 0.006, '#ffb08f', 0.06, 0.03, 0.012, udang); s1.rotation.z = 0.5;
  const s2 = kotak(0.1, 0.006, 0.006, '#ffb08f', 0.06, 0.03, -0.012, udang); s2.rotation.z = 0.35;
  kotak(0.01, 0.01, 0.045, '#111', 0.02, 0.018, 0, udang);
  udang.position.set(0.06, -R * 0.62, 0.08);
  grp.add(udang);
  const tick = t => {
    const a = t * 0.9;   // bandeng berenang memutar
    bandeng.position.set(Math.cos(a) * 0.16, 0.02 + Math.sin(t * 1.7) * 0.03, Math.sin(a) * 0.16);
    bandeng.rotation.y = -a - Math.PI / 2;
    e1.rotation.y = e2.rotation.y = Math.sin(t * 9) * 0.5;
    udang.position.x = 0.06 + Math.sin(t * 0.6) * 0.1;           // udang merayap di pasir
    udang.rotation.y = Math.cos(t * 0.6) > 0 ? 0 : Math.PI;
    udang.position.y = -R * 0.62 + Math.abs(Math.sin(t * 3)) * 0.012;
  };
  tick(0);
  return { group: grp, tick };
}

// Profil tetap Cak Darjo (dipakai peta, studio video, dan gambar profil)
export const LOOK_DARJO = { kulit: '#ecc39b', baju: '#b7cdbf', celana: '#2e3440', rambut: '#2b211b', kacamata: true };
export const OPT_DARJO = { gaya: 'genz', batik: 'navy', kaos: '#f6f4ef', jam: true, tongkat: true };
export function makeCharUmum(look, opt = {}) { return makeChar(look, opt); }
// Foto avatar 3D warga (kepala + bahu) untuk KTP & kartu info. Satu renderer kecil dipakai ulang.
let _potret = null;
export function potretWarga(w, ukuran = 256, latar = '#cfe8ef') {
  if (!_potret) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.12;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight('#e4eef2', '#9a9070', 1.7));
    const sun = new THREE.DirectionalLight('#ffe3bd', 2.3); sun.position.set(2, 4, 5); sc.add(sun);
    const cam = new THREE.PerspectiveCamera(26, 0.82, 0.1, 50);
    _potret = { r, sc, cam };
  }
  const { r, sc, cam } = _potret;
  const tinggi = Math.round(ukuran / 0.82);
  r.setPixelRatio(1); r.setSize(ukuran, tinggi, false); cam.aspect = ukuran / tinggi; cam.updateProjectionMatrix();
  sc.background = new THREE.Color(latar);
  const ch = makeChar(lookFor(w), {}); ch.userData.ekspresi('normal'); ch.rotation.y = -0.18; sc.add(ch);
  cam.position.set(0.45, 2.1, 2.9); cam.lookAt(0, 1.95, 0);
  r.render(sc, cam);
  const cv = document.createElement('canvas'); cv.width = ukuran; cv.height = tinggi;
  cv.getContext('2d').drawImage(r.domElement, 0, 0);
  sc.remove(ch);
  return cv;
}
export function makeCakDarjo(extra = {}) { return makeChar(LOOK_DARJO, Object.assign({}, OPT_DARJO, extra)); }

export function makeAyam(r) {
  const vb = new VB();
  const c = r() < 0.5 ? '#ffffff' : '#c8743c';
  vb.box(0, 0.2, 0, 0.42, 0.34, 0.55, c).box(0, 0.45, 0.25, 0.26, 0.28, 0.26, c).box(0, 0.73, 0.27, 0.08, 0.12, 0.18, '#e63946');
  vb.box(0, 0.5, 0.42, 0.1, 0.07, 0.1, '#f4a261').box(0, 0.35, -0.3, 0.3, 0.28, 0.12, c === '#ffffff' ? '#e0e0e0' : '#7a3e1d');
  vb.box(-0.1, 0, 0, 0.06, 0.2, 0.06, '#f4a261').box(0.1, 0, 0, 0.06, 0.2, 0.06, '#f4a261');
  return vb.build();
}

// ---------------------------------------------------------------- dunia
export function createWorld(canvas, { onPick, onDekat, manual = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // mode ringan otomatis untuk HP / perangkat lambat
  const RINGAN = manual ? false : (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, RINGAN ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;   // bayangan lembut lewat shadow.radius (lebih ringan dari VSM)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // warna lembut ala film
  renderer.toneMappingExposure = 1.12;
  renderer.localClippingEnabled = true;   // untuk bangunan yang sedang dibangun

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#dfe6e4', 60, 165);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2600);
  camera.position.set(34, 38, 40);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 12;
  controls.maxDistance = 220;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.addEventListener('change', () => {
    const t = controls.target;
    const cx = THREE.MathUtils.clamp(t.x, BATAS.x0 + 8, BATAS.x1 - 8), cz = THREE.MathUtils.clamp(t.z, BATAS.z0 + 6, BATAS.z1 - 6);
    if (cx !== t.x || cz !== t.z) { camera.position.x += cx - t.x; camera.position.z += cz - t.z; t.x = cx; t.z = cz; }
  });

  const hemi = new THREE.HemisphereLight('#e4eef2', '#8b845c', 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe3bd', 2.6);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(RINGAN ? 1024 : 2048, RINGAN ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
  sun.shadow.bias = -0.0006; sun.shadow.radius = RINGAN ? 2 : 4;
  scene.add(sun); scene.add(sun.target);
  const sunOff = new THREE.Vector3(30, 50, 20);

  const statik = new THREE.Group(); scene.add(statik);
  const bangunanG = new THREE.Group(); scene.add(bangunanG);
  const charsG = new THREE.Group(); scene.add(charsG);
  const awanG = new THREE.Group(); scene.add(awanG);

  const graph = buildGraph();
  const nodeKeys = [...graph.keys()];
  const chars = [];
  const ayam = [];
  let kota = null, maskot = null;
  const bangunanPos = new Map();
  let rintangan = [];   // tapak bangunan (untuk tabrakan & deteksi bangunan terdekat)
  let pohonPos = [];    // posisi pohon (untuk tabrakan)

  // ---------- lingkungan statis
  function buildStatic(footprints) {
    statik.clear();
    const r = rng(7);
    const tanah = new VB();
    const hijau = ['#a2b867', '#a7bc6b', '#9fb464'];
    for (let x = -32; x < 32; x += 2) for (let z = -32; z < 34; z += 2) {
      const cz = z + 1;
      if (cz > RIVER[0] && cz < RIVER[1]) continue;
      tanah.box(x + 1, -0.6, cz, 2, 0.6, 2, hijau[Math.floor(r() * 3)]);
    }
    tanah.box(0, -1.4, 23, 64, 0.8, 4, '#6f5a3c');
    tanah.box(0, -0.75, 23, 64, 0.5, 4, 'water');
    const gt = tanah.build({ shadow: false }); gt.children.forEach(m => { m.castShadow = false; }); statik.add(gt);

    const jalan = new VB();
    const aspal = !!(kota && kota.jalan); // false = masih jalan setapak tanah
    if (aspal) {
      for (const z of LINES) {
        jalan.box(0, 0, z, EDGE * 2, 0.06, ROAD_W, '#6e6b67');
        for (let x = -EDGE + 1; x < EDGE; x += 2.2) if (!LINES.some(l => Math.abs(l - x) < 2)) jalan.box(x, 0.06, z, 1.1, 0.01, 0.14, '#f1f1f1');
      }
      for (const x of LINES) {
        const z1 = -EDGE, z2 = x === 0 ? 31 : 16;
        jalan.box(x, 0, (z1 + z2) / 2, ROAD_W, 0.06, z2 - z1, '#6e6b67');
        for (let z = z1 + 1; z < z2; z += 2.2) if (!LINES.some(l => Math.abs(l - z) < 2) && !(z > RIVER[0] - 1 && z < RIVER[1] + 1)) jalan.box(x, 0.061, z, 0.14, 0.01, 1.1, '#f1f1f1');
      }
      for (const z of LINES) for (const s of [-1, 1]) jalan.box(0, 0, z + s * (ROAD_W / 2 + 0.25), EDGE * 2, 0.12, 0.5, '#d8d0bf');
      for (const z of LINES) for (let x = -24; x <= 24; x += 8) { if (LINES.includes(x)) continue; jalan.box(x, 0, z - 2.1, 0.15, 2.8, 0.15, '#3a3a3a'); jalan.box(x, 2.8, z - 1.8, 0.2, 0.12, 0.8, '#3a3a3a'); jalan.box(x, 2.65, z - 1.45, 0.4, 0.18, 0.4, 'lamp'); }
    } else {
      // jalan setapak tanah
      for (const z of LINES) jalan.box(0, 0, z, EDGE * 2, 0.04, 1.8, '#d7c49c');
      for (const x of LINES) { const z1 = -EDGE, z2 = x === 0 ? 31 : 16; jalan.box(x, 0, (z1 + z2) / 2, 1.8, 0.04, z2 - z1, '#d7c49c'); }
      // tiang lentera kayu di pinggir jalan setapak
      for (const z of LINES) for (let x = -24; x <= 24; x += 8) { if (LINES.includes(x)) continue; jalan.box(x, 0, z - 1.4, 0.14, 2.2, 0.14, '#6b4a2a'); jalan.box(x, 2.2, z - 1.4, 0.34, 0.36, 0.34, 'lamp'); jalan.box(x, 2.56, z - 1.4, 0.44, 0.1, 0.44, '#3d2a1e'); }
      for (const x of LINES) for (let z = -20; z <= 12; z += 8) { if (LINES.some(l => Math.abs(l - z) < 3)) continue; jalan.box(x + 1.4, 0, z, 0.14, 2.2, 0.14, '#6b4a2a'); jalan.box(x + 1.4, 2.2, z, 0.34, 0.36, 0.34, 'lamp'); jalan.box(x + 1.4, 2.56, z, 0.44, 0.1, 0.44, '#3d2a1e'); }
      for (let i = 0; i < 120; i++) { const l = LINES[i % 3], t = (r() - 0.5) * 2 * EDGE; if (i % 2) jalan.box(t, 0.04, l + (r() - 0.5) * 1.4, 0.3, 0.03, 0.3, '#a88a60'); else jalan.box(l + (r() - 0.5) * 1.4, 0.04, Math.min(t, 16), 0.3, 0.03, 0.3, '#a88a60'); }
    }
    // jembatan bambu (selalu ada supaya bisa menyeberang)
    jalan.box(0, 0, 23, aspal ? 3.6 : 2.2, 0.3, 6, '#9c6b3c');
    for (const s of aspal ? [-1.75, 1.75] : [-1.05, 1.05]) { jalan.box(s, 0.3, 23, 0.18, 0.7, 6, '#7a4f2b'); for (let z = 20.2; z <= 25.8; z += 1.4) jalan.box(s, 0.3, z, 0.25, 0.9, 0.25, '#6b4527'); }
    statik.add(jalan.build());

    // pepohonan, hindari jalan, sungai, bangunan
    const pohonVB = new VB();
    const bebas = (x, z, m = 1.5) => {
      if (Math.abs(x) > 31 || z < -31 || z > 32) return false;
      if (z > RIVER[0] - 1 && z < RIVER[1] + 1) return false;
      for (const l of LINES) { if (Math.abs(z - l) < ROAD_W / 2 + m && Math.abs(x) <= EDGE + 1) return false; if (Math.abs(x - l) < ROAD_W / 2 + m && z <= (l === 0 ? 32 : 17)) return false; }
      for (const f of footprints) if (Math.abs(x - f.x) < f.w / 2 + m && Math.abs(z - f.z) < f.d / 2 + m) return false;
      return true;
    };
    let ditanam = 0;
    pohonPos = [];
    for (let i = 0; i < 900 && ditanam < 150; i++) {
      const x = (r() - 0.5) * 64, z = (r() - 0.5) * 66;
      if (!bebas(x, z)) continue;
      pohon(pohonVB, x, z, r, (z > 17 || Math.abs(x) > 27) && r() < 0.6 ? 'kelapa' : 'biasa');
      pohonPos.push([x, z]);
      ditanam++;
    }
    // pohon & semak di tepi sungai
    for (let x = -30; x <= 30; x += 3.3) { if (Math.abs(x) < 3) continue; if (r() < 0.5) pohon(pohonVB, x, RIVER[0] - 0.9, r, 'kelapa'); else pohonVB.bola(x, 0, RIVER[0] - 0.8, 1.1, 0.8, 1.1, '~#7a9a4a'); }
    statik.add(pohonVB.build());
    pohonPos.push(...bangunKawasan(statik, kota, footprints, r));
    bangunDaerah(statik, r, footprints, RINGAN);   // Sidoarjo asli: sawah, tambak, sungai, jalan, jembatan, rel & bandara rencana   // sawah, tambak, pantai, lahan rencana (skala 1:2 m)

    // ---- detail tanah: ribuan helai rumput, bunga kecil, batu bersegi, bukit di kejauhan
    const diJalan = (x, z, m) => {
      const lebar = (aspal ? ROAD_W / 2 + 0.6 : 1.1) + m;
      for (const l of LINES) { if (Math.abs(z - l) < lebar && Math.abs(x) <= EDGE + 0.5) return true; if (Math.abs(x - l) < lebar && z <= (l === 0 ? 31.5 : 16.5) && z >= -EDGE - 0.5) return true; }
      return z > RIVER[0] - 0.6 && z < RIVER[1] + 0.6;
    };
    const diBangunan = (x, z, m = 0.2) => footprints.some(f => Math.abs(x - f.x) < f.w / 2 + m && Math.abs(z - f.z) < f.d / 2 + m);
    const tabur = (geo, mat, n, cek, skala, warna) => {
      const im = new THREE.InstancedMesh(geo, mat, n); const o = new THREE.Object3D(); const cl = new THREE.Color(); let k = 0;
      for (let t = 0; t < n * 3 && k < n; t++) {
        const x = (r() - 0.5) * 63, z = (r() - 0.5) * 65;
        if (!cek(x, z)) continue;
        const sc = skala(); o.position.set(x, 0, z); o.rotation.set(0, r() * 6.28, (r() - 0.5) * 0.4); o.scale.set(sc, sc * (0.7 + r() * 0.7), sc); o.updateMatrix();
        im.setMatrixAt(k, o.matrix); if (warna) im.setColorAt(k, cl.set(warna[Math.floor(r() * warna.length)])); k++;
      }
      im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; statik.add(im); return im;
    };
    const geoRumput = new THREE.ConeGeometry(0.035, 0.28, 3); geoRumput.translate(0, 0.14, 0);
    tabur(geoRumput, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), RINGAN ? 4500 : 9000,
      (x, z) => !diJalan(x, z, 0) && !diBangunan(x, z), () => 0.7 + r() * 0.8, ['#7a9445', '#86a04c', '#6f8a3e', '#91ab58']);
    const geoBunga = new THREE.IcosahedronGeometry(0.05, 0); geoBunga.translate(0, 0.12, 0);
    tabur(geoBunga, new THREE.MeshStandardMaterial({ roughness: 0.8 }), RINGAN ? 450 : 900,
      (x, z) => !diJalan(x, z, 0.2) && !diBangunan(x, z), () => 0.8 + r() * 0.6, ['#fdfbf3', '#f6d66b', '#c9b7e8', '#f4b7c4']);
    const geoBatu = new THREE.DodecahedronGeometry(0.3, 0); geoBatu.translate(0, 0.12, 0);
    const batu = tabur(geoBatu, new THREE.MeshStandardMaterial({ color: '#bdb5a5', roughness: 0.95, flatShading: true }), 45,
      (x, z) => !diJalan(x, z, 0.8) && !diBangunan(x, z, 1) && !pohonPos.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 2), () => 0.6 + r() * 1.3);
    batu.castShadow = true;
    bangunHutan(statik, r, RINGAN);   // hutan & gunung di luar batas kabupaten   // hutan larangan + pegunungan di batas luar (ganti bukit lama)

    // awan
    awanG.clear();
    for (let i = 0; i < 34; i++) {
      const vb = new VB();
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) vb.bola(k * 1.8 - n, r() * 0.6, (r() - 0.5) * 2, 2.8 + r() * 1.5, 1.6 + r(), 2.4 + r() * 1.2, '~#fbf7ef');
      const c = vb.build({ shadow: false });
      c.children.forEach(m => { m.material = MAT_AWAN; });
      c.position.set(BATAS.x0 + r() * (BATAS.x1 - BATAS.x0), 150 + r() * 40, BATAS.z0 + r() * (BATAS.z1 - BATAS.z0)); c.scale.setScalar(2.4);
      c.userData.v = 0.4 + r() * 0.6;
      awanG.add(c);
    }
  }

  // ---------- bangunan
  // ---------- rumah warga (Rumahku): papan nama penghuni di atas rumah
  const rumahHolder = new Map(); let penghuniTerakhir = {}, kodeRumahSaya = '';
  function papanUntuk(h) {   // buat / perbarui papan nama satu rumah (hanya kalau isinya berubah)
    const d = h.userData.pick.data, p = penghuniTerakhir[d.id], saya = p && kodeRumahSaya && p.kode === kodeRumahSaya;
    const kunci = p ? (saya ? 'S' : 'P') + p.nama : 'K';
    if (h.userData.papanKunci === kunci && h.userData.papanRumah) return h.userData.papanRumah;
    const lama = h.userData.papanRumah; if (lama) { h.remove(lama); lama.material.map.dispose(); lama.material.dispose(); }
    const sp = p ? textSprite((saya ? '⭐ Rumahku · ' : '🏠 ') + p.nama, saya ? { bg: 'rgba(15,76,92,.96)', fg: '#ffd166', size: 0.9 } : { bg: 'rgba(255,255,255,.95)', fg: '#16324f', size: 0.8, border: '#2a9d8f' })
      : textSprite(h.userData.kawasan ? '🔑 Kosong' : '🔑 Kosong · ketuk untuk menempati', { bg: 'rgba(255,248,236,.95)', fg: '#8a5a00', size: 0.7, border: '#f2a33a' });
    h.userData.jarakPapan = p ? 60 : h.userData.kawasan ? 24 : 1e4;
    sp.position.set(0, h.userData.kawasan ? 4.7 : 3.55, 0); h.add(sp); h.userData.papanRumah = sp; h.userData.papanKunci = kunci;
    return sp;
  }
  function pasangPapanRumah() {
    for (const [id, h] of rumahHolder) {
      const p = penghuniTerakhir[id];
      h.userData.pick.data.penghuni = p || null;
      if (!h.userData.kawasan || p) papanUntuk(h);   // rumah perumahan yang kosong: papan dibuat saat kamera mendekat
      else if (h.userData.papanRumah && h.userData.papanKunci !== 'K') { const l = h.userData.papanRumah; h.remove(l); l.material.map.dispose(); l.material.dispose(); h.userData.papanRumah = null; h.userData.papanKunci = null; }
    }
  }
  let lodHitung = 0;
  // rumpun padi 3D yang rapat, hanya di sawah sekitar kamera (dipasang ulang saat kamera berpindah jauh)
  const PADI_N = RINGAN ? 9000 : 26000;
  const geoRumpun = (() => {   // satu rumpun = 5 helai daun melengkung keluar
    const daun = [];
    for (let i = 0; i < 5; i++) { const d = new THREE.ConeGeometry(0.035, 0.7, 3, 1).translate(0, 0.35, 0); d.rotateZ(0.32 + (i % 2) * 0.12); d.rotateY(i / 5 * Math.PI * 2); daun.push(d.toNonIndexed()); }
    return mergeGeometries(daun);
  })();
  const padiIM = new THREE.InstancedMesh(geoRumpun,
    new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true, side: THREE.DoubleSide }), PADI_N);
  padiIM.count = 0; padiIM.frustumCulled = false; padiIM.receiveShadow = true; scene.add(padiIM);
  let padiPusat = null; const _o = new THREE.Object3D(), _c = new THREE.Color(), _cam = new THREE.Vector3();
  function aturPadi() {
    camera.getWorldDirection(_cam); const tx = camera.position.x + _cam.x * 28, tz = camera.position.z + _cam.z * 28;
    if (camera.position.y > 70) { padiIM.visible = false; return; }
    padiIM.visible = true;
    if (padiPusat && (padiPusat[0] - tx) ** 2 + (padiPusat[1] - tz) ** 2 < 20 * 20) return;
    padiPusat = [tx, tz]; let k = 0; const R = RINGAN ? 40 : 58, rr = rng(Math.round(tx) * 31 + Math.round(tz));
    for (const [cx, cz, c, uk = 1] of PETAK_SAWAH) {
      if ((cx - tx) ** 2 + (cz - tz) ** 2 > R * R || k >= PADI_N) continue;
      const kuning = c === '#d6c25a' || c === '#b8c95a';
      for (let x = -10.9 * uk - (uk < 1 ? 0.2 : 0); x <= 10.9 * uk; x += 0.55) for (let z = -6.9 * uk; z <= 6.9 * uk; z += 0.6) {
        if (k >= PADI_N) break;
        _o.position.set(cx + x + (rr() - 0.5) * 0.2, -0.02, cz + z + (rr() - 0.5) * 0.2); _o.rotation.set((rr() - 0.5) * 0.25, rr() * 6.28, (rr() - 0.5) * 0.25);
        const sk = 0.8 + rr() * 0.45; _o.scale.set(sk, sk * (0.85 + rr() * 0.4), sk); _o.updateMatrix(); padiIM.setMatrixAt(k, _o.matrix);
        padiIM.setColorAt(k, _c.set(kuning ? (rr() < 0.5 ? '#c9b24a' : '#b5a03c') : (rr() < 0.5 ? '#5f9a32' : '#7bb043')).multiplyScalar(0.85 + rr() * 0.3)); k++;
      }
    }
    padiIM.count = k; padiIM.instanceMatrix.needsUpdate = true; if (padiIM.instanceColor) padiIM.instanceColor.needsUpdate = true;
  }
  // rumput 3D: ribuan helai rapat di tanah lapang sekitar kamera (bukan jalan, sungai, sawah, perumahan, kota)
  const RUMPUT_N = RINGAN ? 18000 : 52000;
  const geoHelai = (() => { const d = []; for (let i = 0; i < 6; i++) { const g = new THREE.ConeGeometry(0.035, 0.26 + (i % 3) * 0.05, 3, 1).translate(0, 0.14, 0); g.rotateZ(0.2 + (i % 3) * 0.2); g.rotateY(i * 1.05); g.translate(Math.cos(i * 2.4) * 0.08, 0, Math.sin(i * 2.4) * 0.08); d.push(g.toNonIndexed()); } return mergeGeometries(d); })();
  const rumputIM = new THREE.InstancedMesh(geoHelai, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), RUMPUT_N);
  rumputIM.count = 0; rumputIM.frustumCulled = false; rumputIM.receiveShadow = true; scene.add(rumputIM);
  let rumputPusat = null; const RUMPUT_WARNA = ['#6f9a3a', '#7ea845', '#8db552', '#5f8a33', '#9bbd5e', '#76a040'];
  function aturRumput() {
    camera.getWorldDirection(_cam); const tx = camera.position.x + _cam.x * 22, tz = camera.position.z + _cam.z * 22;
    if (camera.position.y > 55) { rumputIM.visible = false; return; }
    rumputIM.visible = true;
    if (rumputPusat && (rumputPusat[0] - tx) ** 2 + (rumputPusat[1] - tz) ** 2 < 14 * 14) return;
    rumputPusat = [tx, tz]; let k = 0; const R = RINGAN ? 26 : 40, rr = rng(Math.round(tx) * 17 + Math.round(tz) * 3);
    for (let t = 0; t < RUMPUT_N * 2.2 && k < RUMPUT_N; t++) {   // titik acak merata dalam lingkaran (pusat lebih rapat)
      const a = rr() * 6.2832, d = R * Math.sqrt(rr()) * (rr() < 0.25 ? rr() : 1), jx = tx + Math.cos(a) * d, jz = tz + Math.sin(a) * d;
      if (kena(jx, jz, 31) || diKota(jx, jz, -2) || !diPoly(jx, jz)) continue;
      _o.position.set(jx, -0.02, jz); _o.rotation.set((rr() - 0.5) * 0.3, rr() * 6.28, (rr() - 0.5) * 0.3);
      const sk = 0.8 + rr() * 0.6; _o.scale.set(sk, sk * (0.7 + rr() * 0.6), sk); _o.updateMatrix(); rumputIM.setMatrixAt(k, _o.matrix);
      rumputIM.setColorAt(k, _c.set(RUMPUT_WARNA[Math.floor(rr() * RUMPUT_WARNA.length)]).multiplyScalar(0.85 + rr() * 0.3)); k++;
    }
    rumputIM.count = k; rumputIM.instanceMatrix.needsUpdate = true; if (rumputIM.instanceColor) rumputIM.instanceColor.needsUpdate = true;
  }
  function papanLod(cam) {   // papan nama rumah hanya tampil kalau kamera cukup dekat (1000 rumah)
    if (lodHitung++ % 5) return;
    for (const h of rumahHolder.values()) {
      const d2 = (h.position.x - cam.x) ** 2 + (h.position.z - cam.z) ** 2;
      if (h.userData.kawasan && !penghuniTerakhir[h.userData.pick.data.id]) {
        if (d2 < 24 * 24) papanUntuk(h).visible = true; else if (h.userData.papanRumah) h.userData.papanRumah.visible = false;
        continue;
      }
      const p = h.userData.papanRumah; if (p) { const r = h.userData.jarakPapan || 1e4; p.visible = d2 < r * r; }
    }
  }
  function buildBangunan() {
    rumahHolder.clear();
    bangunanG.clear();
    bangunanPos.clear();
    const fps = [];
    // rumah perumahan: posisi dihitung dari kavling + nomor rumah, digambar sekaligus per blok (ringan untuk 1000 rumah)
    const tata = tataRumahBlok(), perBlok = new Map();
    for (const b of kota.bangunan || []) {
      if (!b.kawasan || b.tampil === false) continue;
      const pr = (kota.perumahan || []).find(p => p.blok === b.blok), K = pr && KAVLING_PERUMAHAN[pr.kavling], h = tata[(+b.no || 1) - 1];
      if (!K || !h) continue;
      b.x = K.x + h.x; b.z = K.z + h.z; b.rot = h.rot;
      const baris = Math.floor(pr.kavling / 5);   // digabung per baris kavling (5 blok) → sedikit draw call
      if (!perBlok.has(baris)) perBlok.set(baris, []);
      perBlok.get(baris).push(b);
    }
    const geoKena = new THREE.BoxGeometry(3.4, 4.0, 3.4).translate(0, 2.0, 0), matKena = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    for (const [blok, rs] of perBlok) {
      const vb = new VB(), vbMobil = new VB(), kena = new THREE.InstancedMesh(geoKena, matKena, rs.length), m4 = new THREE.Matrix4(), daftar = [];
      rs.forEach((b, k) => {
        const r = rng(b.id);
        if (kota.modelRumah === 'lama') rumahTerasLama(vb, b.x, b.z, b.rot, PALET_RUMAH[Math.floor(r() * PALET_RUMAH.length)], r);
        else rumahTeras(vb, b.x, b.z, b.rot, PALET_RUMAH[Math.floor(r() * PALET_RUMAH.length)], r, vbMobil, kendaraanRumah(b.id));
        m4.makeTranslation(b.x, 0, b.z); kena.setMatrixAt(k, m4);
        const holder = new THREE.Group(); holder.position.set(b.x, 0, b.z);
        holder.userData.pick = { jenis: 'bangunan', data: b }; holder.userData.kawasan = true;
        bangunanG.add(holder); daftar.push(holder);
        if (b.status === 'selesai') rumahHolder.set(b.id, holder);
        bangunanPos.set(b.id, new THREE.Vector3(b.x, 0, b.z));
        fps.push({ x: b.x, z: b.z, w: 3.1, d: 3.1, b });
      });
      const gr = vb.build(); gr.userData.barisKawasan = blok; bangunanG.add(gr);   // ditandai: video bisa "membangun" per baris
      if (vbMobil.parts.size) { const gm = vbMobil.build(); gm.userData.mobilKawasan = blok; bangunanG.add(gm); }
      kena.userData.pickList = daftar; kena.instanceMatrix.needsUpdate = true; kena.computeBoundingSphere(); bangunanG.add(kena);
    }
    for (const b of kota.bangunan || []) {
      if (b.tampil === false || b.kawasan) continue;
      const T = TIPE[b.tipe] || TIPE.rumah;
      const rot = ((+b.rot || 0) % 360) * Math.PI / 180;
      const quarter = Math.round((+b.rot || 0) / 90) % 2 !== 0;
      const w = quarter ? T.d : T.w, d = quarter ? T.w : T.d;
      fps.push({ x: +b.x, z: +b.z, w, d, b, lewat: ['alunalun', 'lapangan'].includes(b.tipe) && b.status !== 'lahan' });
      const holder = new THREE.Group();
      holder.position.set(+b.x, 0, +b.z);
      holder.userData.pick = { jenis: 'bangunan', data: b };
      const r = rng(b.id || b.nama);
      let model;
      if (b.status === 'lahan') {
        const vb = new VB();
        vb.box(0, 0, 0, T.w - 0.4, 0.1, T.d - 0.4, '#b08a5a');
        for (let i = 0; i < 6; i++) vb.box((r() - 0.5) * (T.w - 2), 0.1, (r() - 0.5) * (T.d - 2), 0.5 + r() * 0.6, 0.25, 0.5 + r() * 0.6, '#9a7548');
        pagarKeliling(vb, T.w - 0.6, T.d - 0.6, '#d9c7a3');
        vb.box(0, 0, T.d / 2 - 0.2, 0.15, 1.5, 0.15, '#6b4a2a').box(0, 1.2, T.d / 2 - 0.2, 1.8, 0.8, 0.1, '#f4ecd8');
        model = vb.build();
        const lb = textSprite('Lahan: ' + b.nama, { bg: 'rgba(244,236,216,.95)', fg: '#5c4033', size: 0.8 });
        lb.position.set(0, 2.6, 0); holder.add(lb);
      } else {
        const vb = new VB(); const ex = [];
        T.build(vb, b, ex, r);
        model = vb.build();
        ex.forEach(e => model.add(e));
        const p = b.status === 'dibangun' ? Math.max(0.15, Math.min(1, (+b.progres || 0) / 100)) : 1;
        if (p < 1) {
          const box = new THREE.Box3().setFromObject(model);
          const H = box.max.y;
          // tampilkan bangunan setinggi progres (dipotong bidang horizontal), bukan digepengkan
          const tinggiPotong = Math.max(0.25, H * p);
          const potong = [new THREE.Plane(new THREE.Vector3(0, -1, 0), tinggiPotong)];
          model.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.clippingPlanes = potong; o.material.clipShadows = true; } });
          const sv = new VB();
          const kaki = [[box.min.x - 0.3, box.min.z - 0.3], [box.max.x + 0.3, box.min.z - 0.3], [box.min.x - 0.3, box.max.z + 0.3], [box.max.x + 0.3, box.max.z + 0.3]];
          for (const [x, z] of kaki) sv.box(x, 0, z, 0.14, H + 0.4, 0.14, '#f2a33a');
          for (let y = 1.2; y < H + 0.4; y += 1.4) {
            sv.box((box.min.x + box.max.x) / 2, y, box.min.z - 0.3, box.max.x - box.min.x + 0.6, 0.1, 0.1, '#f2a33a');
            sv.box((box.min.x + box.max.x) / 2, y, box.max.z + 0.3, box.max.x - box.min.x + 0.6, 0.1, 0.1, '#f2a33a');
            sv.box(box.min.x - 0.3, y, (box.min.z + box.max.z) / 2, 0.1, 0.1, box.max.z - box.min.z + 0.6, '#f2a33a');
            sv.box(box.max.x + 0.3, y, (box.min.z + box.max.z) / 2, 0.1, 0.1, box.max.z - box.min.z + 0.6, '#f2a33a');
          }
          for (let i = 0; i < 4; i++) sv.box(box.max.x - 0.6 - i * 0.5, 0, box.max.z + 1.0, 0.45, 0.3, 0.9, '#9e9e9e');
          holder.add(sv.build());
          const lb = textSprite(`🚧 Dibangun ${Math.round(p * 100)}%`, { bg: 'rgba(255,209,102,.96)', fg: '#3d2a00', size: 0.85 });
          lb.position.set(0, H + 0.8, 0); holder.add(lb);
        }
      }
      holder.add(model);
      holder.rotation.y = -rot;
      bangunanG.add(holder);
      if (b.id) bangunanPos.set(b.id, new THREE.Vector3(+b.x, 0, +b.z));
      if (b.huni && b.id && b.status === 'selesai') rumahHolder.set(b.id, holder);
    }
    // papan pengumuman (isi diatur admin)
    const pp = Object.assign({}, PAPAN_BAWAAN, kota.papan || {});
    if (pp.tampil !== false) {
      const papan = buatPapan(pp);
      const px = +pp.x, pz = +pp.z;
      papan.position.set(px, 0, pz); papan.rotation.y = (+pp.rot || 45) * Math.PI / 180;
      const data = { id: 'papan', nama: pp.judul || 'Pengumuman', ket: pp.isi || '', status: 'selesai', papan: true };
      papan.userData.pick = { jenis: 'bangunan', data };
      bangunanG.add(papan);
      fps.push({ x: px, z: pz, w: 2.8, d: 1.4, b: data });
      bangunanPos.set('papan', new THREE.Vector3(px, 0, pz));
    }
    return fps;
  }

  // ---------- karakter
  function nearestNode(x, z) {
    let best = null, bd = 1e9;
    for (const n of graph.values()) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n.k; } }
    return best;
  }

  function spawn(look, opt, info, r) {
    const g = makeChar(look, opt);
    const s = opt.skala || 0.62;
    g.scale.setScalar(s);
    const lbl = textSprite(info.label, info.labelStyle);
    lbl.position.y = 2.95; lbl.scale.multiplyScalar(1 / s * 0.82);
    g.add(lbl);
    g.userData.pick = { jenis: info.jenis, data: info.data };
    const start = nodeKeys[Math.floor(r() * nodeKeys.length)];
    const n = graph.get(start);
    g.position.set(n.x, 0, n.z);
    const c = { g, from: start, to: null, t: 0, speed: 1.4 + r() * 0.9, wait: r() * 3, path: [], mode: 'jalan', tujuan: null, phase: r() * 10, r };
    charsG.add(g);
    chars.push(c);
    return c;
  }

  // jabatan: { [kode]: 'Ketua RT Blok A' }
  function setWarga(list, kodeSaya, jabatan = {}) {
    const lama = pemain ? { pos: pemain.g.position.clone(), rot: pemain.g.rotation.y } : null;
    pemain = null;
    for (const c of chars.splice(0)) charsG.remove(c.g);
    const r = rng(42);
    // maskot
    const m = (kota && kota.maskot) || { nama: 'Cak Darjo' };
    maskot = spawn(LOOK_DARJO, Object.assign({}, OPT_DARJO, { skala: 0.74 }),
      { label: '★ ' + m.nama, labelStyle: { bg: 'rgba(242,140,40,.97)', fg: '#fff', size: 0.95 }, jenis: 'maskot', data: m }, r);
    maskot.speed = 1.6;
    for (const w of list || []) {
      const saya = w.kode && w.kode === kodeSaya;
      const jab = w.kode && jabatan[w.kode];
      const label = (jab ? `🎖 ${jab} · ` : '') + (saya ? '⭐ ' : '') + w.nama;
      const style = jab ? { bg: 'rgba(230,180,34,.97)', fg: '#3b2a00', size: 0.88, border: '#8a6500' }
        : saya ? { bg: 'rgba(15,76,92,.96)', fg: '#ffd166', size: 0.9 } : { bg: 'rgba(255,255,255,.93)', fg: '#16324f', size: 0.75 };
      spawn(lookFor(w), jab ? { selempang: '#e6b422', skala: 0.68 } : {}, {
        label, labelStyle: style, jenis: 'warga', data: Object.assign({}, w, jab ? { jabatan: jab } : {}),
      }, r);
    }
    if (pemainKode) {
      const c = chars.find(x => x.g.userData.pick.data && x.g.userData.pick.data.kode === pemainKode);
      if (c) { pasangPemain(c); if (lama) { c.g.position.copy(lama.pos); c.g.rotation.y = lama.rot; } }
      else { pemainKode = null; ikuti = null; aturKontrolMain(false); }
    }
    // ayam berkeliaran
    for (const a of ayam.splice(0)) charsG.remove(a.g);
    const ra = rng(9);
    const pusat = [[16, -3], [3, 3], [-14, 19], [27, -12]];
    const nAyam = Math.max(0, Math.min(20, +(kota && kota.ayam) || 0));
    for (let i = 0; i < nAyam; i++) {
      const g = makeAyam(ra); g.scale.setScalar(0.8);
      const [cx, cz] = pusat[i % pusat.length];
      g.position.set(cx + (ra() - 0.5) * 3, 0, cz + (ra() - 0.5) * 3);
      charsG.add(g);
      ayam.push({ g, cx, cz, tx: g.position.x, tz: g.position.z, wait: ra() * 2, ra });
    }
    jadwalMaskot();
    for (const [kode, e] of [...tamu]) { tamu.delete(kode); if (e.w) pasangTamu(kode, { w: e.w, x: e.tx, z: e.tz, ry: e.ry, j: e.jalan }); }
  }

  function jadwalMaskot() {
    if (!maskot || !kota || !kota.maskot) return;
    const j = kota.maskot.jadwal || [];
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const menit = now.getHours() * 60 + now.getMinutes();
    const toM = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
    const slot = j.find(s => { const a = toM(s.mulai), b = toM(s.selesai); return a <= b ? (menit >= a && menit < b) : (menit >= a || menit < b); });
    maskot.slot = slot || null;
    maskot.path = [];
    if (slot && slot.lok !== 'keliling' && bangunanPos.has(slot.lok)) {
      const p = bangunanPos.get(slot.lok);
      maskot.mode = 'tuju';
      maskot.tujuan = nearestNode(p.x, p.z);
      maskot.hadap = p;
    } else { maskot.mode = 'jalan'; maskot.tujuan = null; }
  }
  setInterval(jadwalMaskot, 30000);

  function stepChar(c, dt, t) {
    if (c.dikontrol) return;
    const a = c.g.userData.anim;
    if (!c.to) {
      if (c.wait > 0) {
        c.wait -= dt;
        a.legs.forEach(l => { l.rotation.x *= 0.8; }); a.arms.forEach(l => { l.rotation.x *= 0.8; });
        if (c.mode === 'tuju' && c.from === c.tujuan && c.hadap) {
          const ang = Math.atan2(c.hadap.x - c.g.position.x, c.hadap.z - c.g.position.z);
          let df = ang - c.g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
          c.g.rotation.y += df * 0.1;
        }
        return;
      }
      const cur = graph.get(c.from);
      if (c.mode === 'tuju' && c.tujuan) {
        if (c.from === c.tujuan) { c.wait = 4; return; }
        if (!c.path.length) c.path = bfs(graph, c.from, c.tujuan);
        c.to = c.path.shift() || null;
      } else {
        const nb = [...cur.n];
        let pilih = nb.filter(k => k !== c.prev);
        if (!pilih.length) pilih = nb;
        c.to = pilih[Math.floor(c.r() * pilih.length)];
      }
      if (!c.to) { c.wait = 2; return; }
      c.t = 0;
      const A = graph.get(c.from), B = graph.get(c.to);
      c.len = Math.hypot(B.x - A.x, B.z - A.z);
    }
    const A = graph.get(c.from), B = graph.get(c.to);
    c.t += dt * c.speed / c.len;
    const dx = (B.x - A.x) / c.len, dz = (B.z - A.z) / c.len;
    const k = Math.min(1, c.t);
    const off = 0.85; // jalan di sisi kiri jalan
    c.g.position.set(A.x + (B.x - A.x) * k - dz * off, 0, A.z + (B.z - A.z) * k + dx * off);
    const ang = Math.atan2(dx, dz);
    let diff = ang - c.g.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    c.g.rotation.y += diff * Math.min(1, dt * 10);
    const sw = Math.sin((t + c.phase) * c.speed * 5) * 0.6;
    a.legs[0].rotation.x = sw; a.legs[1].rotation.x = -sw; a.arms[0].rotation.x = -sw; a.arms[1].rotation.x = sw;
    c.g.position.y = Math.abs(Math.cos((t + c.phase) * c.speed * 5)) * 0.04;
    if (c.t >= 1) {
      c.prev = c.from; c.from = c.to; c.to = null;
      if (c.mode === 'jalan' && c.r() < 0.25) c.wait = 1 + c.r() * 3;
      if (c.mode === 'tuju' && c.from === c.tujuan) { c.wait = 6; c.path = []; }
    }
  }

  function stepAyam(a, dt, t) {
    const p = a.g.position;
    if (a.wait > 0) { a.wait -= dt; p.y = 0; return; }
    const dx = a.tx - p.x, dz = a.tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.1) { a.wait = 0.5 + a.ra() * 2.5; a.tx = a.cx + (a.ra() - 0.5) * 4; a.tz = a.cz + (a.ra() - 0.5) * 4; return; }
    const v = Math.min(d, dt * 1.2);
    p.x += dx / d * v; p.z += dz / d * v;
    p.y = Math.abs(Math.sin(t * 14)) * 0.08;
    a.g.rotation.y = Math.atan2(dx, dz);
  }

  // ---------- hujan (ikut cuaca asli Sidoarjo; diatur dari main.js / video)
  let hujan = 0;
  const N_HUJAN = RINGAN ? 700 : 1600;
  const posHujan = new Float32Array(N_HUJAN * 6), velHujan = new Float32Array(N_HUJAN);
  const geoHujan = new THREE.BufferGeometry(); geoHujan.setAttribute('position', new THREE.BufferAttribute(posHujan, 3));
  const tetes = new THREE.LineSegments(geoHujan, new THREE.LineBasicMaterial({ color: '#cfe0f0', transparent: true, opacity: 0.55, fog: false }));
  tetes.frustumCulled = false; tetes.visible = false; scene.add(tetes);
  const rh = rng(77);
  for (let i = 0; i < N_HUJAN; i++) { posHujan[i * 6] = (rh() - 0.5) * 70; posHujan[i * 6 + 1] = rh() * 30; posHujan[i * 6 + 2] = (rh() - 0.5) * 70; velHujan[i] = 22 + rh() * 10; }
  function stepHujan(dt) {
    if (!hujan) return;
    const cx = controls.target.x, cz = controls.target.z, n = Math.floor(N_HUJAN * Math.min(1, 0.25 + hujan * 0.75));
    geoHujan.setDrawRange(0, n * 2);
    for (let i = 0; i < n; i++) {
      const j = i * 6; let y = posHujan[j + 1] - velHujan[i] * dt;
      if (y < 0) { y += 30; posHujan[j] = cx + (rh() - 0.5) * 70; posHujan[j + 2] = cz + (rh() - 0.5) * 70; }
      posHujan[j + 1] = y; posHujan[j + 3] = posHujan[j] - 0.12; posHujan[j + 4] = y + 0.9; posHujan[j + 5] = posHujan[j + 2];
    }
    geoHujan.attributes.position.needsUpdate = true;
  }
  function setHujan(k) { hujan = Math.max(0, Math.min(1, +k || 0)); tetes.visible = hujan > 0; updateLangit(); }

  // ---------- siang & malam (WIB)
  const LANGIT = [
    [0, '#1b2440', 0.3, 0.18], [4.5, '#263052', 0.35, 0.18], [5.5, '#f0c3a0', 0.9, 1.0], [7, '#d6e2e4', 1.4, 2.3],
    [15, '#d6e2e4', 1.5, 2.6], [17.2, '#f1bf93', 1.1, 1.6], [18.4, '#4a4a70', 0.55, 0.45], [19.5, '#1b2440', 0.32, 0.18], [24, '#1b2440', 0.3, 0.18],
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();
  let malam = false, lampuMati = false;
  const cvLangit = document.createElement('canvas'); cvLangit.width = 4; cvLangit.height = 256;
  const texLangit = new THREE.CanvasTexture(cvLangit); texLangit.colorSpace = THREE.SRGBColorSpace;
  function langitGradasi(bawah, gelapMalam) {
    const x = cvLangit.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
    const atas = bawah.clone().lerp(new THREE.Color(gelapMalam ? '#0d1330' : '#8fb9d6'), gelapMalam ? 0.6 : 0.55);
    gr.addColorStop(0, '#' + atas.getHexString()); gr.addColorStop(0.62, '#' + bawah.getHexString()); gr.addColorStop(1, '#' + bawah.getHexString());
    x.fillStyle = gr; x.fillRect(0, 0, 4, 256); texLangit.needsUpdate = true; return texLangit;
  }
  let jamTetap = null; // dipakai mode video: jam langit tetap
  let kabutSkala = 1;   // mode video: kabut bisa dibuat lebih jauh untuk shot udara
  function updateLangit() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const h = jamTetap ?? (now.getHours() + now.getMinutes() / 60);
    let i = 0; while (i < LANGIT.length - 2 && LANGIT[i + 1][0] <= h) i++;
    const [h0, c0, e0, s0] = LANGIT[i], [h1, c1, e1, s1] = LANGIT[i + 1];
    const k = (h - h0) / (h1 - h0 || 1);
    malam = h < 5.6 || h >= 18.2;
    cA.set(c0).lerp(cB.set(c1), k);
    scene.fog.color.copy(cA); scene.background = langitGradasi(cA, malam);
    hemi.intensity = (e0 + (e1 - e0) * k) * (1 - hujan * 0.25);
    sun.intensity = (s0 + (s1 - s0) * k) * (1 - hujan * 0.7);
    if (hujan) { cA.lerp(cB.set('#8f9ba4'), hujan * 0.3); scene.fog.color.copy(cA); scene.background = langitGradasi(cA, malam); }
    warnaGunung(scene.fog.color, malam);
    scene.fog.near = (60 - hujan * 12) * kabutSkala; scene.fog.far = (165 - hujan * 30) * kabutSkala;
    const ang = ((h - 6) / 12) * Math.PI;
    sunOff.set(Math.cos(ang) * 40, Math.max(12, Math.sin(ang) * 55), 22);
    sun.position.copy(sunOff).add(sun.target.position);
    sun.color.set(h < 6 || h > 18.5 ? '#9fb4ff' : h < 8 || h > 16.5 ? '#ffc98f' : '#ffe3bd');
    const glow = malam ? '#ffcf6b' : '#000000';
    winMat.emissive.set(glow); winMat.emissiveIntensity = malam ? 0.9 : 0;
    const nyala = malam && !lampuMati;   // lampuMati: hanya untuk adegan video "sebelum ada lampu"
    lampMat.emissive.set(nyala ? '#ffe0a0' : '#000'); lampMat.emissiveIntensity = nyala ? 1.3 : 0;
    MAT_PENDAR.visible = MAT_SINAR.visible = nyala;
    return { jam: h, malam };
  }
  setInterval(updateLangit, 30000);

  // ---------- interaksi
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 8 || performance.now() - down.t > 500) { down = null; return; }
    down = null;
    const rc = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects([charsG, bangunanG], true);
    for (const h of hits) {
      if (h.object.userData.pickList && h.instanceId != null) { const o = h.object.userData.pickList[h.instanceId]; onPick && onPick(o.userData.pick, o); return; }
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o) { onPick && onPick(o.userData.pick, o); return; }
    }
    onPick && onPick(null);
  });

  let fokus = null;
  function fokusKe(x, z) { fokus = { x, z, t: 0, sx: controls.target.x, sz: controls.target.z, cx: camera.position.x, cz: camera.position.z }; }

  let sudahUkur = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!sudahUkur) {
      sudahUkur = true;
      const jarak = w / h < 0.8 ? 84 : 66; // HP potret butuh kamera lebih jauh
      camera.position.copy(controls.target).add(new THREE.Vector3(34, 38, 40).setLength(jarak));
    }
  }
  new ResizeObserver(resize).observe(canvas);

  let ikuti = null;
  // ---------- MODE JALAN-JALAN: pemilik KTP menggerakkan karakternya sendiri
  let pemain = null, pemainKode = null, dekatId = null;
  const masukan = { x: 0, y: 0 };
  const _f = new THREE.Vector3();
  function bisaDi(x, z) {
    if (!diPeta(x, z, 2) || z > 32.5) return false;
    if (Math.abs(x) < 33 && z > RIVER[0] - 0.3 && z < RIVER[1] + 0.3 && Math.abs(x) > (kota && kota.jalan ? 1.5 : 0.85)) return false; // hanya lewat jembatan
    if (!diKota(x, z) && kena(x, z, 2) && !kena(x, z, 1) && SUNGAI.some(s => { for (let k = 0; k + 1 < s.p.length; k++) { const [ax, az] = s.p[k], [bx, bz] = s.p[k + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); if (Math.hypot(ax + dx * t - x, az + dz * t - z) < s.lebar / 2) return true; } return false; })) return false;   // tidak bisa jalan di air (kecuali jembatan)
    for (const f of rintangan) if (!f.lewat && Math.abs(x - f.x) < f.w / 2 + 0.15 && Math.abs(z - f.z) < f.d / 2 + 0.15) return false;
    for (const [px, pz] of pohonPos) if ((x - px) ** 2 + (z - pz) ** 2 < 0.3) return false;
    return true;
  }
  // ---------- Mode Ramai: warga lain yang sedang online (data dari ramai.js)
  const tamu = new Map();   // kode -> { c, sendiri, tx, tz, ry, jalan, w }
  function cariChar(kode) { return chars.find(x => x.g.userData.pick.data && x.g.userData.pick.data.kode === kode); }
  function lepasChar(c) {
    c.dikontrol = false; c.to = null; c.path = []; c.wait = 1;
    c.from = nearestNode(c.g.position.x, c.g.position.z); c.g.position.y = 0;
  }
  function pasangTamu(kode, d) {
    let e = tamu.get(kode);
    if (e && !chars.includes(e.c)) { tamu.delete(kode); e = null; }   // peta baru saja dibangun ulang
    if (!e) {
      let c = cariChar(kode), sendiri = false;
      if (c && c === pemain) return;
      if (!c) {
        c = spawn(lookFor(d.w), {}, { label: '🟢 ' + d.w.nama, labelStyle: { bg: 'rgba(22,130,90,.96)', fg: '#fff', size: 0.85 }, jenis: 'warga', data: d.w }, rng(kode));
        sendiri = true;
      }
      c.dikontrol = true; c.to = null; c.path = [];
      c.g.position.set(d.x, 0, d.z); c.g.rotation.y = d.ry || 0;
      e = { c, sendiri }; tamu.set(kode, e);
    }
    Object.assign(e, { tx: d.x, tz: d.z, ry: d.ry || 0, jalan: !!d.j, w: d.w });
  }
  function hapusTamu(kode) {
    const e = tamu.get(kode); if (!e) return;
    tamu.delete(kode);
    if (e.sendiri) { const i = chars.indexOf(e.c); if (i >= 0) chars.splice(i, 1); charsG.remove(e.c.g); }
    else if (chars.includes(e.c)) lepasChar(e.c);
  }
  let waktuKini = 0;
  function stepTamu(dt, t) {
    for (const e of tamu.values()) {
      const p = e.c.g.position, a = e.c.g.userData.anim;
      const dx = e.tx - p.x, dz = e.tz - p.z, jarak = Math.hypot(dx, dz);
      if (jarak > 12) { p.x = e.tx; p.z = e.tz; } else { const k = Math.min(1, dt * 7); p.x += dx * k; p.z += dz * k; }
      let df = e.ry - e.c.g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); e.c.g.rotation.y += df * Math.min(1, dt * 10);
      const jalan = e.jalan || jarak > 0.08, sw = jalan ? Math.sin(t * 11) * 0.7 : 0;
      a.legs[0].rotation.x = sw; a.legs[1].rotation.x = -sw; a.arms[0].rotation.x = -sw; a.arms[1].rotation.x = sw;
      const diJembatan = Math.abs(p.x) < 1.8 && p.z > 19.9 && p.z < 26.1;
      p.y = (diJembatan ? 0.3 : 0) + (jalan ? Math.abs(Math.cos(t * 11)) * 0.05 : 0);
    }
    // gelembung chat menghilang setelah 5 detik
    for (const c of chars) { const gb = c.g.userData.gelembung; if (gb && t > gb.userData.sampai) { c.g.remove(gb); gb.material.map.dispose(); gb.material.dispose(); c.g.userData.gelembung = null; } }
  }
  function gelembung(kode, teks) {
    const c = kode === null ? pemain : cariChar(kode); if (!c) return;
    const lama = c.g.userData.gelembung; if (lama) c.g.remove(lama);
    const sp = gelembungSprite(teks), s = c.g.scale.x || 0.62;
    sp.position.y = 3.6; sp.scale.multiplyScalar(1 / s * 0.82); sp.userData.sampai = waktuKini + 5;
    c.g.add(sp); c.g.userData.gelembung = sp;
  }

  function stepPemain(dt, t) {
    const c = pemain, a = c.g.userData.anim, p = c.g.position;
    const mag = Math.min(1, Math.hypot(masukan.x, masukan.y));
    let jalan = false;
    if (mag > 0.08) {
      _f.subVectors(controls.target, camera.position); _f.y = 0; _f.normalize();
      const dx = _f.x * -masukan.y - _f.z * masukan.x, dz = _f.z * -masukan.y + _f.x * masukan.x;
      const l = Math.hypot(dx, dz) || 1, v = 4.2 * mag * dt;
      const nx = p.x + dx / l * v, nz = p.z + dz / l * v;
      const terjebak = !bisaDi(p.x, p.z);
      if (terjebak || bisaDi(nx, nz)) { p.x = nx; p.z = nz; jalan = true; }
      else if (bisaDi(nx, p.z)) { p.x = nx; jalan = true; }
      else if (bisaDi(p.x, nz)) { p.z = nz; jalan = true; }
      let df = Math.atan2(dx, dz) - c.g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
      c.g.rotation.y += df * Math.min(1, dt * 12);
    }
    const sw = jalan ? Math.sin(t * 11) * 0.7 * mag : 0;
    a.legs[0].rotation.x = sw; a.legs[1].rotation.x = -sw; a.arms[0].rotation.x = -sw; a.arms[1].rotation.x = sw;
    const diJembatan = Math.abs(p.x) < 1.8 && p.z > 19.9 && p.z < 26.1;
    p.y = (diJembatan ? 0.3 : 0) + (jalan ? Math.abs(Math.cos(t * 11)) * 0.05 : 0);
    // bangunan terdekat
    let best = null, bd = 2;
    for (const f of rintangan) {
      const d = Math.hypot(Math.max(0, Math.abs(p.x - f.x) - f.w / 2), Math.max(0, Math.abs(p.z - f.z) - f.d / 2));
      if (d < bd) { bd = d; best = f; }
    }
    const id = best ? (best.b.id || best.b.nama) : null;
    if (id !== dekatId) { dekatId = id; onDekat && onDekat(best ? best.b : null); }
  }
  function aturKontrolMain(aktif) {
    controls.enablePan = !aktif;
    controls.mouseButtons = aktif ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = aktif ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE } : { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  }
  function pasangPemain(c) {
    pemain = c; c.dikontrol = true; c.to = null; c.path = [];
    ikuti = c.g;
  }

  const timer = new THREE.Timer(); timer.connect(document);
  function langkah(dt, t, kameraManual) {
    for (const c of chars) { stepChar(c, dt, t); if (c.g.userData.tick) c.g.userData.tick(t); }
    waktuKini = t;
    if (pemain) stepPemain(dt, t);
    stepTamu(dt, t);
    stepHujan(dt);
    for (const a of ayam) stepAyam(a, dt, t);
    for (const c of awanG.children) { c.position.x += c.userData.v * dt; if (c.position.x > BATAS.x1 + 100) c.position.x = BATAS.x0 - 100; }
    stepBangjo(t);
    aturPadi(); aturRumput();
    if (!kameraManual) {   // matahari & bayangan ikut area yang sedang dilihat (peta sekarang luas)
      const tg = controls.target; sun.target.position.set(tg.x, 0, tg.z); sun.position.x = tg.x + sunOff.x; sun.position.z = tg.z + sunOff.z;
      sun.target.updateMatrixWorld();
      papanLod(camera.position);
      // kabut menyesuaikan jarak kamera: dekat = suasana berkabut, jauh = peta luas tetap terlihat
      const jk = Math.max(1, camera.position.distanceTo(tg) / 55) * kabutSkala;
      scene.fog.near = (60 - hujan * 12) * jk; scene.fog.far = (165 - hujan * 30) * jk;
    }
    if (fokus) {
      fokus.t = Math.min(1, fokus.t + dt * 1.8);
      const e = 1 - Math.pow(1 - fokus.t, 3);
      const nx = fokus.sx + (fokus.x - fokus.sx) * e, nz = fokus.sz + (fokus.z - fokus.sz) * e;
      camera.position.x += nx - controls.target.x; camera.position.z += nz - controls.target.z;
      controls.target.x = nx; controls.target.z = nz;
      if (fokus.t >= 1) fokus = null;
    }
    if (ikuti) {
      const p = ikuti.position;
      camera.position.x += (p.x - controls.target.x) * 0.08; camera.position.z += (p.z - controls.target.z) * 0.08;
      controls.target.x += (p.x - controls.target.x) * 0.08; controls.target.z += (p.z - controls.target.z) * 0.08;
    }
    if (!kameraManual) controls.update();
    renderer.render(scene, camera);
  }
  if (!manual) renderer.setAnimationLoop(() => {
    timer.update();
    langkah(Math.min(timer.getDelta(), 0.05), timer.getElapsed(), false);
  });
  resize();

  return {
    setKota(k) {
      kota = k;
      const fps = buildBangunan();
      pasangPapanRumah();
      rintangan = fps;
      buildStatic(fps);
      jadwalMaskot();
      return updateLangit();
    },
    setWarga,
    langit: updateLangit,
    zoom(f) {
      const off = camera.position.clone().sub(controls.target);
      const len = THREE.MathUtils.clamp(off.length() * f, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(off.setLength(len));
    },
    fokusBangunan(id) { const p = bangunanPos.get(id); if (p) fokusKe(p.x, p.z); },
    fokusKe(x, z) { ikuti = null; fokusKe(x, z); },
    // posisi "aku" untuk peta: karakter yang dijalankan, atau titik tengah layar
    posisiSaya: () => pemain ? { x: pemain.g.position.x, z: pemain.g.position.z, ry: pemain.g.rotation.y, jalan: true }
      : { x: controls.target.x, z: controls.target.z, ry: Math.atan2(controls.target.x - camera.position.x, controls.target.z - camera.position.z), jalan: false },
    posisiBangunan: id => bangunanPos.get(id) || null,
    dataPeta: () => dataPeta(kota),
    ikuti(obj) {
      ikuti = obj || (pemain ? pemain.g : null);
      if (obj) { // dekatkan kamera supaya label terbaca
        const off = camera.position.clone().sub(controls.target);
        if (off.length() > 34) camera.position.copy(controls.target).add(off.setLength(34));
      }
    },
    cariWarga(kode) { return chars.find(c => c.g.userData.pick.data && c.g.userData.pick.data.kode === kode); },
    maskot: () => maskot,
    mulaiMain(kode) {
      const c = chars.find(x => x.g.userData.pick.data && x.g.userData.pick.data.kode === kode);
      if (!c) return false;
      pemainKode = kode; pasangPemain(c); aturKontrolMain(true);
      fokus = null;
      const off = camera.position.clone().sub(controls.target);
      off.y = 0; off.setLength(24); off.y = 21; // agak tinggi supaya tidak terhalang pohon
      controls.target.set(c.g.position.x, 0, c.g.position.z);
      camera.position.copy(controls.target).add(off);
      dekatId = null;
      return true;
    },
    selesaiMain() {
      if (pemain) {
        const k = nearestNode(pemain.g.position.x, pemain.g.position.z);
        Object.assign(pemain, { dikontrol: false, from: k, to: null, path: [], wait: 1.5 });
        pemain.g.position.y = 0;
      }
      pemain = null; pemainKode = null; ikuti = null; masukan.x = masukan.y = 0;
      aturKontrolMain(false);
      if (dekatId !== null) { dekatId = null; onDekat && onDekat(null); }
    },
    gerak(x, y) { masukan.x = x; masukan.y = y; },
    sedangMain: () => !!pemain,
    setHujan, hujan: () => hujan,
    setLampuMati(v) { if (lampuMati !== !!v) { lampuMati = !!v; updateLangit(); } },
    setPenghuni(map, kodeSaya) { penghuniTerakhir = map || {}; kodeRumahSaya = kodeSaya || ''; pasangPapanRumah(); },
    // Mode Ramai
    tamu: pasangTamu, tamuPergi: hapusTamu, gelembung,
    jumlahTamu: () => tamu.size,
    statusPemain: () => pemain ? { x: pemain.g.position.x, z: pemain.g.position.z, ry: pemain.g.rotation.y, j: Math.hypot(masukan.x, masukan.y) > 0.08 } : null,
    karakter: () => chars,
    // ----- untuk mode video (manual)
    frame(dt, t) { langkah(dt, t, true); },
    setJam(h) { jamTetap = h; updateLangit(); },
    setKabut(k) { kabutSkala = k || 1; updateLangit(); },
    // mode video: matahari, bayangan & kabut ikut titik yang sedang dibidik kamera (shot udara jauh dari alun-alun)
    ikutKamera(tx, tz) {
      sun.target.position.set(tx, 0, tz); sun.position.x = tx + sunOff.x; sun.position.z = tz + sunOff.z; sun.target.updateMatrixWorld();
      const jk = Math.max(1, Math.hypot(camera.position.x - tx, camera.position.y, camera.position.z - tz) / 55) * kabutSkala;
      scene.fog.near = (60 - hujan * 12) * jk; scene.fog.far = (165 - hujan * 30) * jk;
    },
    scene, camera, renderer, controls,
    posisiPemain: () => pemain ? [pemain.g.position.x, pemain.g.position.z] : null,
    bisaDi,
  };
}
export { VB, mat };
