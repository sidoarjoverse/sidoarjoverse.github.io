// Gedung PENERBIT BENANG MERAH (mitra pertama SidoarjoVerse).
// Di dalam: galeri megah berisi karya EKSKLUSIF penyawer Rp15.000 (data/museum-benang-merah.json, dipajang manual).
// Di depan: tugu Buku Puisi Netizen — semua warga ber-KTP boleh menulis (Supabase: tabel puisi, fungsi tulis_puisi).
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { VB, makeUtas, makeSulam } from './world.js';
import * as D from './data.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SLOT = 16;   // jumlah bingkai di galeri (8 kiri, 8 kanan)

function bungkus(g, teks, maks) {
  const out = [];
  for (const par of String(teks).split('\n')) {
    let baris = '';
    for (const k of par.split(' ')) { const c = baris ? baris + ' ' + k : k; if (g.measureText(c).width > maks && baris) { out.push(baris); baris = k; } else baris = c; }
    out.push(baris);
  }
  return out;
}
// kertas puisi di dalam bingkai (atau slot kosong ajakan menyawer)
function kertas(k) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 680; const g = cv.getContext('2d');
  g.fillStyle = k ? '#fbf6ea' : '#efe6d6'; g.fillRect(0, 0, 512, 680);
  g.strokeStyle = '#c8321f'; g.lineWidth = 6; g.strokeRect(18, 18, 476, 644);
  g.textAlign = 'center'; g.fillStyle = '#c8321f';
  if (!k) {
    g.font = '900 34px Georgia, serif'; g.fillText('✍️', 256, 230);
    g.font = '800 30px Georgia, serif'; g.fillText('Panggonan iki', 256, 300); g.fillText('kanggo karyamu', 256, 340);
    g.fillStyle = '#5b4636'; g.font = '600 22px system-ui, sans-serif';
    g.fillText('Sawer Rp15.000 nang Saweria', 256, 420); g.fillText('lan tulis puisimu nang notes', 256, 452);
    g.fillStyle = '#c8321f'; g.font = '700 20px system-ui, sans-serif'; g.fillText('saweria.co/sidoarjoverse', 256, 500);
  } else {
    g.font = 'italic 800 34px Georgia, serif';
    let y = 92; for (const b of bungkus(g, k.judul || 'Tanpa Judul', 430).slice(0, 2)) { g.fillText(b, 256, y); y += 42; }
    g.fillStyle = '#2b2622'; g.font = '22px Georgia, serif'; y += 14;
    const isi = bungkus(g, k.isi || '', 420); for (const b of isi.slice(0, 15)) { g.fillText(b, 256, y); y += 30; }
    if (isi.length > 15) { g.fillText('…', 256, y); }
    g.fillStyle = '#c8321f'; g.font = '700 22px system-ui, sans-serif'; g.fillText('— ' + (k.nama || 'anonim'), 256, 620);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function papanTeks(teks, sub, w = 1024, h = 220) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.fillStyle = '#1d1d1d'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8321f'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
  g.textAlign = 'center'; g.fillStyle = '#f5c518'; g.font = '900 80px Georgia, serif'; g.fillText(teks, w / 2, 112);
  g.fillStyle = '#fbf8f1'; g.font = '600 34px system-ui, sans-serif'; g.fillText(sub, w / 2, 178);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function adeganMuseum(museum, karya) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a2420');
  scene.add(new THREE.HemisphereLight('#fff2dc', '#5a2a2a', 1.25));
  const L = 30, W = 12, H = 7.5, v = new VB();
  v.box(0, -0.1, 0, W, 0.1, L, '#5b3a2a');                                         // lantai kayu
  for (let z = -L / 2 + 1; z < L / 2; z += 2) v.box(0, -0.06, z, W, 0.02, 0.04, '#4a2e21');
  v.box(0, -0.04, 0, 3, 0.03, L - 2, '#c8321f');                                    // karpet merah
  v.box(0, H, 0, W, 0.2, L, '#efe4cf');                                             // langit-langit
  for (const sx of [-1, 1]) { v.box(sx * W / 2, 0, 0, 0.2, H, L, '#efe6d6').box(sx * (W / 2 - 0.12), 0, 0, 0.06, 1.3, L, '#1f5a4e').box(sx * (W / 2 - 0.14), 1.3, 0, 0.06, 0.1, L, '#e8b84a').box(sx * (W / 2 - 0.12), H - 0.6, 0, 0.06, 0.6, L, '#8a9e7e'); }
  v.box(0, 0, -L / 2, W, H, 0.2, '#f3ead8').box(0, 0, L / 2, W, H, 0.2, '#f3ead8');
  for (let z = -L / 2 + 4; z < L / 2; z += 6.5) v.box(0, H - 1.2, z, 0.08, 1.2, 0.08, '#d9aa2b').bola(0, H - 2.1, z, 1.3, 0.9, 1.3, '#f5d77a');   // lampu gantung
  v.box(0, 0, -L / 2 + 3, 2.6, 1.2, 2.6, '#d8cfbd').box(0, 1.2, -L / 2 + 3, 2.9, 0.15, 2.9, '#d9aa2b');            // alas patung
  for (const sx of [-1, 1]) for (let z = -8; z <= 8; z += 8) v.box(sx * 2.6, 0, z, 1.6, 0.45, 0.6, '#5a3a24');        // bangku galeri
  scene.add(v.build());
  for (let z = -L / 2 + 4; z < L / 2; z += 6.5) { const l = new THREE.PointLight('#ffe2a8', 14, 14, 1.6); l.position.set(0, H - 2.4, z); scene.add(l); }
  const knot = new THREE.Group(); knot.position.set(0, 2.45, -L / 2 + 3); scene.add(knot);   // gulungan benang merah
  knot.add(new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 18), new THREE.MeshStandardMaterial({ color: '#c8321f', roughness: 0.8 })));
  for (let k = 0; k < 8; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.025, 6, 40), new THREE.MeshStandardMaterial({ color: '#a82614' })); t.rotation.set(k * 0.4, k * 0.75, k * 0.3); knot.add(t); }
  const tl = new THREE.TextureLoader().load('aset/benang-merah/logo.jpg'); tl.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: tl })); banner.position.set(0, 5.2, -L / 2 + 0.12); scene.add(banner);
  const sub = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.8), new THREE.MeshBasicMaterial({ map: papanTeks('GALERI KARYA', 'Mitra Pertama SidoarjoVerse', 1024, 160) })); sub.position.set(0, 3.0, -L / 2 + 0.12); sub.visible = false; scene.add(sub);
  const u = makeUtas(); u.position.set(-1.9, 0, -L / 2 + 3.6); u.rotation.y = 0.3; scene.add(u);
  const sl = makeSulam(); sl.position.set(1.9, 0, -L / 2 + 3.6); sl.rotation.y = -0.3; scene.add(sl);
  const bingkai = [], emasM = new THREE.MeshStandardMaterial({ color: '#1d1d1d', roughness: 0.5 });
  for (let i = 0; i < SLOT; i++) {
    const sisi = i % 2 ? 1 : -1, z = -L / 2 + 6 + Math.floor(i / 2) * 3.1, k = karya[i] || null;
    const g = new THREE.Group(); g.position.set(sisi * (W / 2 - 0.16), 3.1, z); g.rotation.y = -sisi * Math.PI / 2;
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.5, 0.1), emasM); g.add(fr);
    const kt = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 2.16), new THREE.MeshBasicMaterial({ map: kertas(k) })); kt.position.z = 0.06; g.add(kt);
    const lampu = new THREE.SpotLight('#fff0cf', k ? 9 : 4, 5, 0.6, 0.5); lampu.position.set(0, 2.2, 1.2); lampu.target = kt; g.add(lampu);
    kt.userData.karya = k; scene.add(g); bingkai.push(kt);
  }
  return { scene, bingkai, knot, L };
}

let aktif = null;
function modal(judul, sub) {
  if (aktif) aktif();
  const el = document.createElement('div'); el.className = 'rumah-modal';
  el.innerHTML = `<div class="rumah-kotak"><div class="rumah-atas"><div><b>${judul}</b><small>${sub}</small></div><button type="button" class="rumah-x" aria-label="Tutup">✕</button></div></div>`;
  document.body.appendChild(el); return el;
}

export async function bukaMuseum({ museum = {}, saya = null, pin = '' } = {}) {
  const data = await D.karyaMuseum(), karya = (data.karya || []).slice(0, SLOT);
  const el = modal('🧶 ' + esc(museum.nama || 'Penerbit Benang Merah'), `🖋️ Galeri karya eksklusif · ${karya.length} karya · ketuk bingkai gawe moco`);
  const kotak = el.querySelector('.rumah-kotak');
  kotak.insertAdjacentHTML('beforeend', `<canvas class="rumah-cv"></canvas><div class="mu-baca" hidden></div><div class="rumah-aksi"></div>`);
  const cv = kotak.querySelector('canvas'), aksi = kotak.querySelector('.rumah-aksi'), baca = kotak.querySelector('.mu-baca');
  aksi.innerHTML = `<button type="button" class="btn oren" id="muBuku">📖 Buku Puisi Netizen</button><a class="btn" href="${esc(data.saweria || 'https://saweria.co/sidoarjoverse')}" target="_blank" rel="noopener">🖋️ Pajang karyamu (Rp15rb)</a><button type="button" class="btn ghost" id="muKeluar">🚪 Keluar</button>`;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  const { scene, bingkai, knot, L } = adeganMuseum(museum, karya);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80), kontrol = new OrbitControls(camera, cv);
  camera.position.set(0, 2.4, L / 2 - 1.5); kontrol.target.set(0, 2.6, 0);
  Object.assign(kontrol, { enableDamping: true, screenSpacePanning: false, minDistance: 1.5, maxDistance: 13, minPolarAngle: 0.9, maxPolarAngle: 1.62 });
  kontrol.addEventListener('change', () => { const t = kontrol.target; t.x = Math.max(-4.5, Math.min(4.5, t.x)); t.z = Math.max(-L / 2 + 2, Math.min(L / 2 - 2, t.z)); t.y = 2.6;
    const p = camera.position; p.x = Math.max(-5.6, Math.min(5.6, p.x)); p.z = Math.max(-L / 2 + 0.5, Math.min(L / 2 - 0.5, p.z)); p.y = Math.max(0.8, Math.min(6.8, p.y)); });
  function ukur() { const w = cv.clientWidth, h = cv.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 66 : 55; camera.updateProjectionMatrix(); }
  ukur(); addEventListener('resize', ukur);
  const ray = new THREE.Raycaster(), m = new THREE.Vector2(); let turun = null;
  cv.addEventListener('pointerdown', e => { turun = [e.clientX, e.clientY]; });
  cv.addEventListener('pointerup', e => {
    if (!turun || Math.hypot(e.clientX - turun[0], e.clientY - turun[1]) > 6) return;
    const r = cv.getBoundingClientRect(); m.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(m, camera); const hit = ray.intersectObjects(bingkai)[0]; if (!hit) return;
    const k = hit.object.userData.karya;
    baca.innerHTML = k ? `<div class="mu-kertas"><h3>${esc(k.judul || 'Tanpa Judul')}</h3><p>${esc(k.isi || '')}</p><div class="mu-nama">— ${esc(k.nama || 'anonim')}${k.tanggal ? ' · ' + esc(k.tanggal) : ''}</div><button type="button" class="btn ghost">Tutup</button></div>`
      : `<div class="mu-kertas"><h3>✍️ Panggonan iki kanggo karyamu</h3><p>Pengen puisi, surat, utowo tulisanmu dipajang nang galeri Penerbit Benang Merah?\n\n1. Sawer Rp15.000 nang Saweria\n2. Tulis karyamu nang kolom pesan/notes\n3. Karyamu dipajang nang kene, iso diwoco sak warga SidoarjoVerse!\n\nIso gawe nembak gebetan, pamitan karo mantan, utowo ucapan gawe ibu 😆</p><a class="btn oren" href="${esc(data.saweria || 'https://saweria.co/sidoarjoverse')}" target="_blank" rel="noopener">🖋️ Sawer & tulis karyamu</a> <button type="button" class="btn ghost">Tutup</button></div>`;
    baca.hidden = false; baca.querySelector('.btn.ghost').onclick = () => { baca.hidden = true; };
  });
  const jam = new THREE.Timer(); jam.connect(document);
  renderer.setAnimationLoop(() => { jam.update(); knot.rotation.y = jam.getElapsed() * 0.4; kontrol.update(); renderer.render(scene, camera); });
  function tutup() {
    renderer.setAnimationLoop(null); removeEventListener('resize', ukur); kontrol.dispose();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(x => { if (x.map) x.map.dispose(); x.dispose(); }); });
    renderer.dispose(); el.remove(); aktif = null;
  }
  el.querySelector('.rumah-x').onclick = tutup; aksi.querySelector('#muKeluar').onclick = tutup;
  aksi.querySelector('#muBuku').onclick = () => { tutup(); bukaBukuPuisi({ saya, pin }); };
  el.addEventListener('click', e => { if (e.target === el) tutup(); });
  aktif = tutup;
}

export async function bukaBukuPuisi({ saya = null, pin = '' } = {}) {
  const el = modal('📖 Buku Puisi Netizen', 'Tugu nang ngarep Penerbit Benang Merah · 1 KTP = 1 puisi · muat 40 puisi');
  const kotak = el.querySelector('.rumah-kotak');
  kotak.insertAdjacentHTML('beforeend', `<div class="mu-buku"><form class="mu-form">${saya ? `
      <div class="meta">✍️ Nulis dadi <b>${esc(saya.nama)}</b> (${esc(saya.kecamatan || '')})</div>
      <input name="judul" maxlength="60" placeholder="Judul puisimu" required>
      <textarea name="isi" maxlength="1000" rows="5" placeholder="Tulis puisimu nang kene… (10–1000 huruf). Siji KTP mung oleh siji puisi, tulis sing apik yo!" required></textarea>
      <button class="btn oren" type="submit">📖 Tulis nang Buku</button><span class="meta mu-pesan"></span>`
    : '<div class="meta">🔒 Gawe KTP sik gawe iso nulis puisi. Moco tetep oleh!</div>'}</form>
    <div class="meta mu-sisa"></div><div class="mu-daftar"><p class="meta">Ngemot puisi…</p></div></div>`);
  const daftar = kotak.querySelector('.mu-daftar'), f = kotak.querySelector('form');
  const tutup = () => { el.remove(); aktif = null; };
  el.querySelector('.rumah-x').onclick = tutup; el.addEventListener('click', e => { if (e.target === el) tutup(); }); aktif = tutup;
  async function muat() {
    try {
      const l = await D.puisiNetizen(40), n = (l && l.length) || 0;
      const sisa = kotak.querySelector('.mu-sisa'); if (sisa) sisa.textContent = `📖 ${n}/40 halaman keisi${n >= 40 ? ' · BUKU WIS KEBAK' : ''}`;
      if (n >= 40 && f) { f.querySelectorAll('input,textarea,button').forEach(x => { x.disabled = true; }); }
      daftar.innerHTML = l && l.length ? l.map(p => `<article class="mu-puisi"><h4>${esc(p.judul)}</h4><p>${esc(p.isi)}</p><div class="mu-nama">— ${esc(p.nama)}${p.kecamatan ? ' · ' + esc(p.kecamatan) : ''}</div></article>`).join('')
        : '<p class="meta">Durung onok puisi. Dadio sing pertama! ✨</p>';
    } catch (e) { daftar.innerHTML = `<p class="meta">⚠️ ${esc(e.message)}</p>`; }
  }
  muat();
  if (saya) f.onsubmit = async e => {
    e.preventDefault(); const ps = f.querySelector('.mu-pesan'), b = f.querySelector('button');
    if (!pin) { ps.textContent = '⚠️ Nulis puisi mung iso teko HP tempat KTP-mu digawe.'; return; }
    b.disabled = true; ps.textContent = 'Nulis…';
    try { await D.tulisPuisi(saya.kode, pin, f.judul.value.trim(), f.isi.value.trim()); f.reset(); ps.textContent = '✅ Puisimu wis nang buku! Matur nuwun 🙏'; f.querySelectorAll('input,textarea,button').forEach(x => { x.disabled = true; }); muat(); }
    catch (er) { ps.textContent = '⚠️ ' + er.message; }
    b.disabled = false;
  };
}
