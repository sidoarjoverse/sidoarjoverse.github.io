// Minigame Mancing di Kolam Pancing Warga: lempar kail → tunggu pelampung "ditarik" → pencet TARIK tepat waktu → kartu iwak.
// Tanpa server (tidak memakai kuota Supabase): koleksi iwak disimpan di HP warga (localStorage).
const IWAK = [
  { n: 'Bandeng', w: [0.3, 1.2], c: ['#c9d1d9', '#8fa0b0'], p: 34, r: 'Umum' },
  { n: 'Mujair', w: [0.2, 0.8], c: ['#7d8f6a', '#4f5f44'], p: 22, r: 'Umum' },
  { n: 'Nila', w: [0.3, 1.1], c: ['#9aa7b5', '#5d6b7a'], p: 16, r: 'Umum' },
  { n: 'Lele', w: [0.4, 1.6], c: ['#5b5246', '#2f2a24'], p: 12, r: 'Langka' },
  { n: 'Gurami', w: [0.6, 2.5], c: ['#c9a36b', '#8a6a3c'], p: 7, r: 'Langka' },
  { n: 'Patin', w: [1.0, 4.0], c: ['#b7c2cc', '#6f7c88'], p: 4, r: 'Epik' },
  { n: 'Koi Emas', w: [0.8, 3.0], c: ['#ffb627', '#e2711d'], p: 3.5, r: 'Epik' },
  { n: 'Hiu Kolam', w: [12, 35], c: ['#6b7b8c', '#e8edf2'], p: 1.5, r: 'Legendaris', hiu: true },
];
const WARNA_R = { Umum: '#2a9d8f', Langka: '#3a86ff', Epik: '#8338ec', Legendaris: '#f28c28' };
const KEY = 'sv_iwakku';
const koleksi = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } };

function acak() { const tot = IWAK.reduce((a, b) => a + b.p, 0); let x = Math.random() * tot; for (const i of IWAK) { if ((x -= i.p) < 0) return i; } return IWAK[0]; }

// gambar iwak sederhana (2D) untuk kartu
function gambarIwak(g, i, cx, cy, s) {
  const [a, b] = i.c;
  g.save(); g.translate(cx, cy); g.scale(s, s);
  if (i.hiu) {
    g.fillStyle = a; g.beginPath(); g.moveTo(-120, 0); g.quadraticCurveTo(-20, -55, 90, -10); g.lineTo(120, 0); g.lineTo(90, 12); g.quadraticCurveTo(-20, 50, -120, 0); g.fill();
    g.fillStyle = b; g.beginPath(); g.moveTo(-100, 4); g.quadraticCurveTo(-10, 40, 90, 8); g.quadraticCurveTo(-10, 22, -100, 4); g.fill();
    g.fillStyle = a; g.beginPath(); g.moveTo(-10, -32); g.lineTo(20, -85); g.lineTo(35, -28); g.fill();
    g.beginPath(); g.moveTo(-115, 0); g.lineTo(-160, -45); g.lineTo(-140, 0); g.lineTo(-160, 40); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(70, -8, 5, 0, 7); g.fill();
    g.strokeStyle = '#333'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(40 - k * 9, -5); g.lineTo(36 - k * 9, 10); g.stroke(); }
  } else {
    const gr = g.createLinearGradient(0, -45, 0, 45); gr.addColorStop(0, b); gr.addColorStop(0.5, a); gr.addColorStop(1, '#f4f4f4');
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 95, 42, 0, 0, 7); g.fill();
    g.fillStyle = b; g.beginPath(); g.moveTo(-85, 0); g.lineTo(-145, -42); g.lineTo(-130, 0); g.lineTo(-145, 42); g.fill();
    g.beginPath(); g.moveTo(-30, -38); g.quadraticCurveTo(10, -75, 40, -38); g.fill();
    g.beginPath(); g.moveTo(-10, 38); g.quadraticCurveTo(10, 62, 30, 36); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(62, -10, 11, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(65, -10, 6, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(k * 18, 0, 26, -0.9, 0.9); g.stroke(); }
    if (i.n === 'Lele') { g.strokeStyle = '#2f2a24'; g.lineWidth = 3; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(88, 8); g.quadraticCurveTo(120, 8 + d * 20, 135, 20 + d * 25); g.stroke(); } }
  }
  g.restore();
}

function buatKartu(i, berat, nama) {
  const cv = document.createElement('canvas'); cv.width = 720; cv.height = 960; const g = cv.getContext('2d');
  const wr = WARNA_R[i.r];
  g.fillStyle = '#0f4c5c'; g.fillRect(0, 0, 720, 960);
  g.fillStyle = wr; g.fillRect(24, 24, 672, 912); g.fillStyle = '#fff8ec'; g.fillRect(40, 40, 640, 880);
  g.fillStyle = '#0f4c5c'; g.font = '900 34px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('🎣 KOLAM PANCING WARGA', 360, 100);
  g.font = '700 24px system-ui, sans-serif'; g.fillStyle = '#5b7083'; g.fillText('SidoarjoVerse', 360, 136);
  const bg = g.createRadialGradient(360, 380, 40, 360, 380, 300); bg.addColorStop(0, '#bfe6f2'); bg.addColorStop(1, '#3f9bb5');
  g.fillStyle = bg; g.fillRect(70, 170, 580, 400);
  for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(90 + (k * 97) % 540, 190 + (k * 53) % 360, 3 + (k % 4), 0, 7); g.fill(); }
  gambarIwak(g, i, 370, 380, i.hiu ? 1.45 : 1.75);
  g.fillStyle = wr; g.fillRect(70, 595, 580, 64); g.fillStyle = '#fff'; g.font = '900 34px system-ui, sans-serif';
  g.fillText('★'.repeat(['Umum', 'Langka', 'Epik', 'Legendaris'].indexOf(i.r) + 1) + '  ' + i.r.toUpperCase(), 360, 640);
  g.fillStyle = '#16324f'; g.font = '900 72px system-ui, sans-serif'; g.fillText(i.n, 360, 740);
  g.font = '800 40px system-ui, sans-serif'; g.fillText(`⚖️ ${berat.toFixed(2).replace('.', ',')} kg`, 360, 800);
  g.font = '700 26px system-ui, sans-serif'; g.fillStyle = '#5b7083';
  g.fillText(`Dipancing ${nama || 'warga'} · ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 360, 860);
  g.fillText('sidoarjoverse.github.io', 360, 895);
  return cv;
}

export function bukaMancing({ nama } = {}) {
  let el = document.getElementById('mancing');
  if (!el) { el = document.createElement('div'); el.id = 'mancing'; el.className = 'mancing'; document.body.appendChild(el); }
  el.hidden = false;
  el.innerHTML = `<div class="mc-kotak"><div class="mc-atas"><b>🎣 Mancing nang Kolam</b><span id="mcKol"></span><button type="button" class="mc-tutup" aria-label="Tutup">✕</button></div>
    <canvas class="mc-kanvas" width="640" height="560"></canvas><div class="mc-pesan" id="mcPesan">Pencet <b>LEMPAR</b> gawe nguncalno kail!</div>
    <button type="button" class="btn oren full mc-tombol" id="mcTombol">🎣 LEMPAR</button></div>`;
  const kv = el.querySelector('canvas'), g = kv.getContext('2d'), tombol = el.querySelector('#mcTombol'), pesan = el.querySelector('#mcPesan');
  const kol = () => { el.querySelector('#mcKol').textContent = `🐟 Koleksi: ${koleksi().length}`; };
  kol();
  let fase = 'siap', t0 = 0, gigit = 0, raf = 0, hasil = null;
  const tutup = () => { cancelAnimationFrame(raf); el.hidden = true; };
  el.querySelector('.mc-tutup').onclick = tutup;
  function gambar(t) {
    const w = kv.width, h = kv.height;
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#9fd3e6'); sky.addColorStop(0.35, '#3f9bb5'); sky.addColorStop(1, '#2f6f86');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8b6a46'; g.fillRect(0, h - 60, w, 60); g.fillStyle = '#6b4f33'; for (let x = 0; x < w; x += 64) g.fillRect(x, h - 60, 4, 60);
    for (let k = 0; k < 8; k++) { const y = 200 + k * 40, o = Math.sin(t / 700 + k) * 20; g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.beginPath(); g.moveTo(40 + o, y); g.lineTo(220 + o, y); g.moveTo(380 - o, y + 15); g.lineTo(560 - o, y + 15); g.stroke(); }
    for (let k = 0; k < 6; k++) { const x = (k * 113 + t / 30) % (w + 80) - 40, y = 260 + (k * 61) % 200; g.globalAlpha = 0.25; g.fillStyle = '#123'; g.beginPath(); g.ellipse(x, y, 26, 9, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
    // joran & senar
    const bx = 400, by0 = 300; let by = by0, sx = 0;
    if (fase === 'tunggu') by = by0 + Math.sin(t / 300) * 3;
    if (fase === 'gigit') { by = by0 + 14 + Math.sin(t / 40) * 8; sx = Math.sin(t / 30) * 6; }
    g.strokeStyle = '#4a3420'; g.lineWidth = 9; g.beginPath(); g.moveTo(40, h - 30); g.lineTo(330, 90); g.stroke();
    if (fase !== 'siap') {
      g.strokeStyle = '#eee'; g.lineWidth = 2; g.beginPath(); g.moveTo(330, 90); g.quadraticCurveTo(bx + sx - 20, 150, bx + sx, by - 10); g.stroke();
      g.fillStyle = '#e63946'; g.beginPath(); g.arc(bx + sx, by - 8, 11, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(bx + sx, by - 8, 11, 0, Math.PI); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; const rr = 18 + ((t / 25) % 30); g.beginPath(); g.ellipse(bx + sx, by + 2, rr, rr * 0.35, 0, 0, 7); g.stroke();
      if (fase === 'gigit') { g.fillStyle = '#ffd166'; g.font = '900 64px system-ui'; g.textAlign = 'center'; g.fillText('!', bx + 50, by - 40); }
    }
    raf = requestAnimationFrame(gambar);
    if (fase === 'tunggu' && t - t0 > gigit) { fase = 'gigit'; t0 = t; pesan.innerHTML = '<b>DISAMBER!</b> Pencet TARIK saiki!'; tombol.textContent = '💪 TARIK!'; if (navigator.vibrate) navigator.vibrate(120); }
    if (fase === 'gigit' && t - t0 > 1100) { fase = 'siap'; pesan.innerHTML = '😩 Telat! Iwak e mlayu. Coba maneh.'; tombol.textContent = '🎣 LEMPAR'; }
  }
  raf = requestAnimationFrame(gambar);
  tombol.onclick = () => {
    const t = performance.now();
    if (fase === 'siap') { fase = 'tunggu'; t0 = t; gigit = 1800 + Math.random() * 4500; pesan.textContent = 'Sabar... ngenteni iwak nyamber 👀'; tombol.textContent = '💪 TARIK!'; return; }
    if (fase === 'tunggu') { fase = 'siap'; pesan.innerHTML = '😅 Kecepeten! Iwak e kaget. Lempar maneh.'; tombol.textContent = '🎣 LEMPAR'; return; }
    if (fase === 'gigit') {
      const i = acak(), berat = i.w[0] + Math.random() * (i.w[1] - i.w[0]);
      const k = koleksi(); k.push({ n: i.n, kg: +berat.toFixed(2), r: i.r, t: Date.now() }); try { localStorage.setItem(KEY, JSON.stringify(k.slice(-300))); } catch (_) {}
      hasil = buatKartu(i, berat, nama); kol(); tampilKartu(i);
    }
  };
  function tampilKartu(i) {
    cancelAnimationFrame(raf); fase = 'kartu';
    const url = hasil.toDataURL('image/png');
    el.querySelector('.mc-kotak').innerHTML = `<div class="mc-atas"><b>${i.hiu ? '😱 HIU KOLAM!' : '🎉 OLEH IWAK!'}</b><span>🐟 Koleksi: ${koleksi().length}</span><button type="button" class="mc-tutup" aria-label="Tutup">✕</button></div>
      <img class="mc-kartu" src="${url}" alt="Kartu iwak ${i.n}">
      <div class="ktp-acts" style="justify-content:center;flex-wrap:wrap">
        <button type="button" class="btn oren" id="mcLagi">🎣 Mancing maneh</button>
        <a class="btn" download="iwak-${i.n.toLowerCase().replace(/\s+/g, '-')}.png" href="${url}">⬇️ Simpan kartu</a>
      </div>`;
    el.querySelector('.mc-tutup').onclick = tutup;
    el.querySelector('#mcLagi').onclick = () => bukaMancing({ nama });
  }
}
