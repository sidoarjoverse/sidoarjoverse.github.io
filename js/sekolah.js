// Bagian dalam sekolah ("Masuk sekolah"): ruang kelas 3D dengan murid-murid.
// Guru (pekerjaan KTP "Guru") masuk sebagai guru di depan kelas; Pelajar/Mahasiswa/Santri masuk sebagai murid.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { VB, makeCharUmum, rng } from './world.js';
import { lookFor } from './avatar.js';

export const PERAN_SEKOLAH = { Guru: 'guru', Pelajar: 'murid', Mahasiswa: 'murid', Santri: 'murid' };

function papanTulis(judul, sapa) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 400; const g = cv.getContext('2d');
  g.fillStyle = '#5a3e24'; g.fillRect(0, 0, 1024, 400); g.fillStyle = '#2f5d46'; g.fillRect(18, 18, 988, 364);
  g.fillStyle = 'rgba(255,255,255,.06)'; for (let k = 0; k < 30; k++) g.fillRect((k * 131) % 980 + 20, (k * 71) % 340 + 20, 60, 3);
  g.textAlign = 'center'; g.fillStyle = '#fdfbf4';
  let fs = 66; do { g.font = `900 ${fs}px system-ui, sans-serif`; fs -= 2; } while (g.measureText(judul).width > 940 && fs > 24);
  g.fillText(judul, 512, 120);
  g.font = '700 46px system-ui, sans-serif'; g.fillStyle = '#ffd166'; g.fillText(sapa, 512, 220);
  g.font = '600 34px system-ui, sans-serif'; g.fillStyle = '#e6f4f1'; g.fillText('Sinau bareng nang SidoarjoVerse ✏️', 512, 310);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function adeganSekolah(sekolah, saya, peran) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9e2cf');
  scene.add(new THREE.HemisphereLight('#fff6e6', '#6b5a48', 1.6));
  const sun = new THREE.DirectionalLight('#ffe9c8', 1.5); sun.position.set(4, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); scene.add(sun);
  const r = rng(sekolah.id || 'sekolah'), vb = new VB();
  for (let i = 0; i < 12; i++) vb.box(-5.5 + i + 0.5, -0.1, 0.5, 0.98, 0.1, 11, i % 2 ? '#d9c7a3' : '#cdb994');   // lantai
  vb.box(0, 3.4, 0.5, 12, 0.12, 11, '#f7f2e6');
  vb.box(0, 0, -5, 11.8, 3.4, 0.15, '#f1e9d2').box(-5.9, 0, 0.5, 0.15, 3.4, 11, '#e7efe0').box(5.9, 0, 0.5, 0.15, 3.4, 11, '#e7efe0');
  for (const z of [-2.5, 0.5, 3.5]) vb.box(5.82, 1.2, z, 0.05, 1.3, 1.6, '#9fd3f0').box(5.8, 1.15, z, 0.06, 0.08, 1.7, '#fff');   // jendela
  vb.box(-3.2, 0, -3.6, 1.8, 0.8, 0.8, '#8d6e4a').box(-3.2, 0.8, -3.6, 1.9, 0.06, 0.9, '#a47148');   // meja guru
  vb.box(4.6, 0, -4.6, 0.9, 1.9, 0.5, '#a47148');   // lemari buku
  for (let i = 0; i < 4; i++) vb.box(4.6, 0.4 + i * 0.4, -4.33, 0.8, 0.28, 0.04, ['#e63946', '#2a9d8f', '#ffd166', '#457b9d'][i]);
  const KURSI = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const x = -3.3 + col * 2.2, z = -0.6 + row * 1.9;
    vb.box(x, 0, z, 1.1, 0.72, 0.6, '#b98258').box(x, 0.72, z, 1.2, 0.05, 0.7, '#c89b6d');   // meja murid
    vb.box(x, 0, z + 0.65, 0.5, 0.42, 0.45, '#6d4527');   // bangku
    KURSI.push([x, z + 0.75]);
  }
  vb.box(0, 2.6, 3, 0.03, 0.8, 0.03, '#333').box(0, 2.5, 3, 0.6, 0.1, 0.6, 'lamp');
  const room = vb.build(); room.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(room);
  const sapa = peran === 'guru' ? `Sugeng rawuh, ${saya.gender === 'P' ? 'Bu' : 'Pak'} ${saya.nama}!` : `Sugeng sinau, ${saya.nama}!`;
  const papan = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.2), new THREE.MeshBasicMaterial({ map: papanTulis((sekolah.nama || 'Sekolah').toUpperCase(), sapa) }));
  papan.position.set(0.6, 1.95, -4.9); scene.add(papan);
  // murid (seragam putih + celana/rok merah/biru)
  const murid = [], celana = ['#c1121f', '#1d3557', '#6c757d'][Math.floor(r() * 3)];
  const pakai = peran === 'murid' ? 6 : -1;   // kursi untuk pemain bila murid
  KURSI.forEach(([x, z], k) => {
    if (k === pakai) return;
    const g = r() < 0.5 ? 'P' : 'L';
    const ch = makeCharUmum({ kulit: ['#f1c6a0', '#e0ac85', '#c98d5a', '#a8714a'][Math.floor(r() * 4)], baju: '#fbfbfb', celana, rambut: ['#1a1a1a', '#2b1d14'][Math.floor(r() * 2)], ...(g === 'P' && r() < 0.6 ? { kerudung: '#fbfbfb' } : {}) }, {});
    ch.scale.setScalar(0.78); ch.position.set(x, 0.0, z); ch.rotation.y = Math.PI; scene.add(ch);
    ch.traverse(o => { if (o.isMesh) o.castShadow = true; });
    ch.userData.ekspresi && ch.userData.ekspresi(r() < 0.6 ? 'senang' : 'normal');
    murid.push({ ch, tangan: (ch.userData.anim && ch.userData.anim.arms || [])[r() < 0.5 ? 0 : 1], ph: r() * 6 });
  });
  // pemain: guru di depan kelas, atau murid di bangku
  const aku = makeCharUmum(lookFor(saya), {}); aku.traverse(o => { if (o.isMesh) o.castShadow = true; });
  if (peran === 'guru') { aku.position.set(-1.2, 0, -3.3); aku.rotation.y = 0.15; } else { const [x, z] = KURSI[pakai]; aku.scale.setScalar(0.78); aku.position.set(x, 0, z); aku.rotation.y = Math.PI; }
  aku.userData.ekspresi && aku.userData.ekspresi('senang'); scene.add(aku);
  return { scene, murid, aku };
}

let aktif = null;
export function bukaSekolah({ sekolah, saya }) {
  if (aktif) aktif();
  const peran = PERAN_SEKOLAH[saya && saya.pekerjaan];
  const el = document.createElement('div'); el.className = 'rumah-modal';
  el.innerHTML = `<div class="rumah-kotak"><div class="rumah-atas"><div><b>🏫 ${(sekolah.nama || 'Sekolah').replace(/</g, '&lt;')}</b><small>${peran === 'guru' ? '👩‍🏫 Sampeyan mlebu dadi GURU' : '🎒 Sampeyan mlebu dadi MURID'}</small></div>
    <button type="button" class="rumah-x" aria-label="Keluar">✕</button></div><canvas class="rumah-cv"></canvas><div class="rumah-aksi"></div></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), aksi = el.querySelector('.rumah-aksi');
  const absen = document.createElement('button'); absen.type = 'button'; absen.className = 'btn oren'; absen.textContent = peran === 'guru' ? '✋ Absen murid' : '✋ Angkat tangan';
  const keluar = document.createElement('button'); keluar.type = 'button'; keluar.className = 'btn ghost'; keluar.textContent = '🚪 Keluar';
  aksi.append(absen, keluar);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true;
  const { scene, murid, aku } = adeganSekolah(sekolah, saya, peran);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
  const kontrol = new OrbitControls(camera, cv);
  if (peran === 'guru') { camera.position.set(1.2, 3.1, -4.5); kontrol.target.set(-0.2, 0.9, 1.6); }   // guru: menghadap murid-murid
  else { camera.position.set(0.5, 3.3, 7.6); kontrol.target.set(0.3, 1.5, -3); }                          // murid: menghadap papan tulis
  Object.assign(kontrol, { enablePan: false, enableDamping: true, minDistance: 3, maxDistance: 11, minPolarAngle: 0.6, maxPolarAngle: 1.5 });
  function ukur() { const w = cv.clientWidth, h = cv.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 60 : 50; camera.updateProjectionMatrix(); }
  ukur(); addEventListener('resize', ukur);
  let angkat = -10; absen.onclick = () => { angkat = performance.now() / 1000; };
  const jam = new THREE.Timer(); jam.connect(document);
  renderer.setAnimationLoop(() => {
    jam.update(); const t = jam.getElapsed(), tn = performance.now() / 1000, semua = tn - angkat < 3;
    for (const m of murid) { m.ch.position.y = Math.abs(Math.sin(t * 1.6 + m.ph)) * 0.015; if (m.tangan) m.tangan.rotation.z = (semua || (t + m.ph) % 9 < 1.3) ? Math.sign(m.tangan.position.x || 1) * (2.6 + Math.sin(t * 10 + m.ph) * 0.15) : m.tangan.rotation.z * 0.85; }
    const ta = aku.userData.anim && aku.userData.anim.arms && aku.userData.anim.arms.find(a => a.position.x > 0);
    if (ta) ta.rotation.z = (peran === 'murid' && semua) || (peran === 'guru' && t % 5 < 1.5) ? 2.4 + Math.sin(t * 12) * 0.3 : ta.rotation.z * 0.85;
    kontrol.update(); renderer.render(scene, camera);
  });
  function tutup() {
    renderer.setAnimationLoop(null); removeEventListener('resize', ukur); kontrol.dispose();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    renderer.dispose(); el.remove(); aktif = null;
  }
  keluar.onclick = tutup; el.querySelector('.rumah-x').onclick = tutup;
  el.addEventListener('click', e => { if (e.target === el) tutup(); });
  aktif = tutup;
}
