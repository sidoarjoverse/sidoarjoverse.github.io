// Bagian dalam rumah warga ("Masuk rumah"): ruangan 3D kecil dengan penghuninya.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { VB, makeCharUmum, rng } from './world.js';
import { lookFor } from './avatar.js';

const DINDING = ['#f3e3c3', '#cfe3dc', '#f2d0c4', '#d8d4ec', '#e6ecc8', '#f6e7a8'];
const SELIMUT = ['#2a9d8f', '#e76f51', '#457b9d', '#8d5a97', '#f4a261'];

function teksPapan(baris1, baris2) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 200; const g = cv.getContext('2d');
  g.fillStyle = '#6d4527'; g.beginPath(); g.roundRect(0, 0, 512, 200, 24); g.fill();
  g.fillStyle = '#fff8ec'; g.beginPath(); g.roundRect(12, 12, 488, 176, 16); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#0f4c5c';
  let fs = 64; do { g.font = `800 ${fs}px "DejaVu Sans", system-ui, sans-serif, "Noto Color Emoji"`; fs -= 2; } while (g.measureText(baris1).width > 460 && fs > 20);
  g.fillText(baris1, 256, 82);
  g.font = '600 32px "DejaVu Sans", system-ui, sans-serif'; g.fillStyle = '#8a5a00'; g.fillText(baris2, 256, 150);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function ruangan(rumah, r) {
  const vb = new VB(), dinding = DINDING[Math.floor(r() * DINDING.length)], selimut = SELIMUT[Math.floor(r() * SELIMUT.length)];
  // lantai papan kayu
  for (let i = 0; i < 9; i++) vb.box(-3.6 + i * 0.8 + 0.4, -0.1, 0.9, 0.78, 0.1, 8.2, i % 2 ? '#c89b6d' : '#bd8f60');
  vb.box(0, 3.2, 0, 7.6, 0.12, 6.7, '#f7efe0');   // plafon
  // dinding belakang, kiri, kanan + lis bawah
  vb.box(0, 0, -3.25, 7.4, 3.2, 0.15, dinding).box(-3.7, 0, 0, 0.15, 3.2, 6.6, dinding).box(3.7, 0, 0, 0.15, 3.2, 6.6, dinding);
  vb.box(0, 0, -3.15, 7.3, 0.35, 0.06, '#8d6e4a').box(-3.6, 0, 0, 0.06, 0.35, 6.4, '#8d6e4a').box(3.6, 0, 0, 0.06, 0.35, 6.4, '#8d6e4a');
  // jendela + tirai di dinding belakang
  vb.box(1.6, 1.3, -3.16, 1.5, 1.1, 0.05, '#9fd3f0').box(1.6, 1.3, -3.13, 1.62, 0.08, 0.05, '#fff').box(1.6, 2.36, -3.13, 1.62, 0.08, 0.05, '#fff');
  vb.box(1.6, 1.3, -3.12, 0.06, 1.1, 0.05, '#fff').box(0.72, 1.1, -3.1, 0.32, 1.45, 0.06, '#e76f51').box(2.48, 1.1, -3.1, 0.32, 1.45, 0.06, '#e76f51');
  // kasur (kiri belakang)
  vb.box(-2.4, 0, -2.0, 1.9, 0.35, 2.3, '#8d6e4a').box(-2.4, 0.35, -2.0, 1.8, 0.25, 2.2, '#f7f3ea').box(-2.4, 0.6, -1.7, 1.82, 0.1, 1.6, selimut);
  vb.box(-2.4, 0.6, -2.85, 1.2, 0.2, 0.45, '#ffffff').box(-2.4, 0, -3.1, 1.95, 1.0, 0.12, '#6d4527');
  // lemari (kanan belakang)
  vb.box(3.05, 0, -2.6, 1.0, 2.3, 0.9, '#a47148').box(2.82, 0.3, -2.14, 0.42, 1.8, 0.03, '#b98258').box(3.28, 0.3, -2.14, 0.42, 1.8, 0.03, '#b98258');
  vb.box(3.0, 1.2, -2.11, 0.05, 0.25, 0.05, '#ffd166').box(3.1, 1.2, -2.11, 0.05, 0.25, 0.05, '#ffd166');
  // meja TV + TV (dinding kanan)
  vb.box(3.2, 0, 0.6, 0.7, 0.55, 1.8, '#6d4527').box(3.25, 0.55, 0.6, 0.12, 0.85, 1.4, '#16181d').box(3.18, 0.62, 0.6, 0.02, 0.7, 1.26, '#2b5d73');
  // sofa + meja kecil + karpet
  vb.box(-0.6, 0, 1.6, 2.4, 0.45, 0.9, '#3d7ea6').box(-0.6, 0.45, 2.0, 2.4, 0.6, 0.2, '#2f6c90').box(-1.85, 0, 1.6, 0.2, 0.75, 0.9, '#2f6c90').box(0.65, 0, 1.6, 0.2, 0.75, 0.9, '#2f6c90');
  vb.box(-0.6, -0.04, 0.3, 3.2, 0.03, 2.2, '#e9c46a').box(-0.6, -0.02, 0.3, 2.8, 0.03, 1.8, '#f4a261');
  vb.box(-0.6, 0, 0.35, 1.2, 0.4, 0.7, '#8d6e4a').box(-0.4, 0.4, 0.35, 0.2, 0.18, 0.2, '#ffffff');
  // tanaman pot, rak buku, jam dinding
  vb.box(-3.2, 0, 2.6, 0.45, 0.45, 0.45, '#c46a3a').bola(-3.2, 0.4, 2.6, 0.8, 0.9, 0.8, '~#4f9a52');
  vb.box(-3.5, 1.4, 0.4, 0.3, 0.06, 1.4, '#8d6e4a').box(-3.5, 1.9, 0.4, 0.3, 0.06, 1.4, '#8d6e4a');
  for (let i = 0; i < 6; i++) vb.box(-3.5, 1.46, -0.15 + i * 0.22, 0.24, 0.32 + (i % 3) * 0.04, 0.16, ['#e63946', '#2a9d8f', '#ffd166', '#457b9d', '#f4a261', '#8d5a97'][i]);
  vb.box(-2.4, 2.25, -3.16, 0.5, 0.5, 0.05, '#ffffff').box(-2.4, 2.47, -3.13, 0.04, 0.18, 0.02, '#16324f').box(-2.33, 2.5, -3.13, 0.16, 0.03, 0.02, '#16324f');
  // lampu gantung
  vb.box(0, 2.6, 0, 0.03, 0.6, 0.03, '#333').box(0, 2.45, 0, 0.5, 0.2, 0.5, 'lamp');
  return vb.build();
}

let aktif = null;
export function tutupRumah() { if (aktif) aktif(); }

// rumah: data bangunan; p: penghuni (atau null); aksi: [{label, kelas, onClick}]
export function bukaRumah({ rumah, p, aksi = [] }) {
  tutupRumah();
  const el = document.createElement('div'); el.className = 'rumah-modal';
  const judul = p ? `🏠 Rumah ${p.nama}` : '🔑 Rumah kosong';
  el.innerHTML = `<div class="rumah-kotak"><div class="rumah-atas"><div><b>${judul.replace(/</g, '&lt;')}</b><small>${(rumah.nama || '').replace(/</g, '&lt;')}${p ? ` · ${p.pekerjaan} · Kec. ${p.kecamatan}`.replace(/</g, '&lt;') : ''}</small></div>
    <button type="button" class="rumah-x" aria-label="Keluar">✕</button></div><canvas class="rumah-cv"></canvas><div class="rumah-aksi"></div></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), kotak = el.querySelector('.rumah-aksi');
  aksi.forEach(a => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (a.kelas || ''); b.textContent = a.label; b.onclick = () => a.onClick(b); kotak.appendChild(b); });
  const keluar = document.createElement('button'); keluar.type = 'button'; keluar.className = 'btn ghost'; keluar.textContent = '🚪 Keluar'; keluar.onclick = () => tutup(); kotak.appendChild(keluar);

  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9dcc6');
  scene.add(new THREE.HemisphereLight('#fff4e0', '#6b5a48', 1.5));
  const sun = new THREE.DirectionalLight('#ffe3bd', 1.6); sun.position.set(2, 6, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(sun);
  const lampu = new THREE.PointLight('#ffd59a', 6, 9, 1.6); lampu.position.set(0, 2.3, 0); scene.add(lampu);
  const r = rng(rumah.id || 'rumah');
  const room = ruangan(rumah, r); room.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(room);
  // papan nama di dinding belakang
  const papan = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.62), new THREE.MeshBasicMaterial({ map: teksPapan(p ? `Rumah ${p.nama}` : 'Rumah Kosong', rumah.nama || '') }));
  papan.position.set(-0.2, 1.75, -3.15); scene.add(papan);
  // penghuni
  let ch = null, tangan = null;
  if (p) {
    ch = makeCharUmum(lookFor(p), {}); ch.position.set(1.15, 0, 2.55); ch.rotation.y = -0.2;
    ch.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(ch);
    ch.userData.ekspresi && ch.userData.ekspresi('senang');
    tangan = (ch.userData.anim && ch.userData.anim.arms || []).find(a => a.position.x > 0) || null;
  } else {
    const kardus = new VB(); for (const [x, z, h] of [[0.4, 0.8, 0.5], [0.95, 0.9, 0.4], [0.65, 0.75, 0.35]]) kardus.box(x, x === 0.65 ? 0.5 : 0, z, 0.55, h, 0.5, '#c8a26b');
    scene.add(kardus.build());
  }
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 60); camera.position.set(0.5, 3.0, 8.0);
  const kontrol = new OrbitControls(camera, cv); kontrol.target.set(0, 1.2, -0.2);
  Object.assign(kontrol, { enablePan: false, enableDamping: true, minDistance: 3.5, maxDistance: 9.5, minPolarAngle: 0.7, maxPolarAngle: 1.45, minAzimuthAngle: -0.75, maxAzimuthAngle: 0.75 });
  function ukur() { const w = cv.clientWidth, h = cv.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 56 : 46; camera.updateProjectionMatrix(); }
  ukur(); addEventListener('resize', ukur);
  const jam = new THREE.Timer(); jam.connect(document);
  renderer.setAnimationLoop(() => {
    jam.update(); const t = jam.getElapsed();
    if (ch) { ch.position.y = Math.abs(Math.sin(t * 2.2)) * 0.02; if (tangan) tangan.rotation.z = t % 6 < 2 ? 2.4 + Math.sin(t * 12) * 0.35 : tangan.rotation.z * 0.85; }
    kontrol.update(); renderer.render(scene, camera);
  });
  function tutup() {
    renderer.setAnimationLoop(null); removeEventListener('resize', ukur); kontrol.dispose();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    renderer.dispose(); el.remove(); aktif = null;
  }
  el.querySelector('.rumah-x').onclick = tutup;
  el.addEventListener('click', e => { if (e.target === el) tutup(); });
  aktif = tutup;
  return { tutup };
}
