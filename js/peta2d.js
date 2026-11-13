// Peta 2D SidoarjoVerse: peta mini (pojok) + peta penuh (menu 🗺️) dengan penanda "Kamu di sini".
// Skala dunia: 1 satuan = 2 m. Data diambil dari world.dataPeta().
const WARNA = {
  sawah: '#b9d27a', tambak: '#9cc3c4', laut: '#5fa3c0', pasir: '#ecdcaa', kota: '#e7e2d3', perum: '#f3e7cf',
  jalan: '#ffffff', jalanTepi: '#9a9488', sungai: '#4f8fb0', lahan: '#e2c99a', hutan: '#5f7a3a', teks: '#16324f',
};

export function pasangPeta({ world, saya, rumahSaya }) {
  const D = world.dataPeta();
  const A = { x0: D.bbox.x0 - 30, x1: D.bbox.x1 + 120, z0: D.bbox.z0 - 30, z1: D.bbox.z1 + 30 };
  // ---------- elemen
  const mini = document.createElement('canvas'); mini.className = 'peta-mini'; mini.width = mini.height = 260;
  mini.title = 'Buka peta'; (document.getElementById('view-peta') || document.body).appendChild(mini);
  const ov = document.createElement('div'); ov.className = 'peta-penuh'; ov.hidden = true;
  ov.innerHTML = `<div class="peta-bar"><b>🗺️ Peta Sidoarjo</b><span class="peta-skala"></span>
    <button type="button" class="peta-btn" data-a="saya">📍 Aku</button>${rumahSaya ? '<button type="button" class="peta-btn" data-a="rumah">🏠 Rumahku</button>' : ''}
    <button type="button" class="peta-tutup" aria-label="Tutup">✕</button></div>
    <canvas class="peta-kanvas"></canvas>
    <div class="peta-info">Geser untuk menjelajah · cubit / scroll untuk zoom · ketuk tempat untuk terbang ke sana · data peta © kontributor OpenStreetMap</div>
    <div class="peta-legenda">
      <span><i style="background:${WARNA.perum}"></i>Perumahan</span><span><i style="background:${WARNA.sawah}"></i>Sawah</span>
      <span><i style="background:${WARNA.tambak}"></i>Tambak</span><span><i style="background:${WARNA.lahan}"></i>Lahan rencana</span>
      <span><i style="background:${WARNA.sungai}"></i>Sungai</span><span><i style="background:#f2a33a"></i>Tol</span><span><i style="background:#e63946;border-radius:50%"></i>Kamu</span></div>`;
  document.body.appendChild(ov);
  const kv = ov.querySelector('.peta-kanvas');

  // ---------- gambar dasar peta (sekali, ke kanvas offscreen)
  const S = 0.6, W0 = Math.ceil((A.x1 - A.x0) * S), H0 = Math.ceil((A.z1 - A.z0) * S);
  const dasar = document.createElement('canvas'); dasar.width = W0; dasar.height = H0;
  const g = dasar.getContext('2d');
  const px = x => (x - A.x0) * S, pz = z => (z - A.z0) * S;
  const jalur = p => { g.beginPath(); p.forEach(([x, z], i) => i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))); };
  g.fillStyle = WARNA.hutan; g.fillRect(0, 0, W0, H0);   // daratan luar kabupaten
  g.fillStyle = WARNA.laut; g.beginPath(); g.moveTo(W0, 0);   // laut di timur garis pantai
  for (let z = A.z0; z <= A.z1; z += 6) g.lineTo(px(D.pantai(z) + 2), pz(z));
  g.lineTo(W0, H0); g.closePath(); g.fill();
  // kabupaten: sawah, lalu tambak dekat pantai
  g.save(); jalur(D.batas); g.closePath(); g.clip();
  g.fillStyle = WARNA.sawah; g.fillRect(0, 0, W0, H0);
  g.fillStyle = WARNA.tambak; g.beginPath(); for (let z = A.z0; z <= A.z1; z += 6) g.lineTo(px(D.pantai(z) - 200), pz(z)); g.lineTo(W0, H0); g.lineTo(W0, 0); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(110,140,70,.25)'; g.lineWidth = 1;
  for (let x = A.x0; x < A.x1; x += 24) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), H0); g.stroke(); }
  for (let z = A.z0; z < A.z1; z += 16) { g.beginPath(); g.moveTo(0, pz(z)); g.lineTo(W0, pz(z)); g.stroke(); }
  g.restore();
  g.strokeStyle = '#2f4f2a'; g.lineWidth = 2; g.setLineDash([6, 4]); jalur(D.batas); g.closePath(); g.stroke(); g.setLineDash([]);
  // bandara & lahan rencana
  if (D.bandara) { g.fillStyle = WARNA.lahan; jalur(D.bandara.p); g.closePath(); g.fill(); g.strokeStyle = '#b08a5a'; g.setLineDash([3, 2]); g.stroke(); g.setLineDash([]); }
  for (const L of D.lahan) { g.fillStyle = WARNA.lahan; g.fillRect(px(L.x - L.w / 2), pz(L.z - L.d / 2), L.w * S, L.d * S); g.strokeStyle = '#b08a5a'; g.setLineDash([3, 2]); g.strokeRect(px(L.x - L.w / 2), pz(L.z - L.d / 2), L.w * S, L.d * S); g.setLineDash([]); }
  // kota
  g.fillStyle = WARNA.kota; for (const p of D.kota) g.fillRect(px(p.x0), pz(p.z0), (p.x1 - p.x0) * S, (p.z1 - p.z0) * S);
  // sungai
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of D.sungai) { g.strokeStyle = WARNA.sungai; g.lineWidth = Math.max(1.5, s.lebar * S); jalur(s.p); g.stroke(); }
  // rel rencana
  g.strokeStyle = '#8a6d47'; g.lineWidth = 3; g.setLineDash([6, 4]); for (const p of D.rel) { jalur(p); g.stroke(); } g.setLineDash([]);
  // jalan
  const LJ = { tol: [7, '#b5651d', '#f2a33a'], raya: [5, '#9a9488', '#ffffff'], kabupaten: [3.5, '#a39d90', '#fbf7ee'], akses: [2.5, '#a39d90', '#fbf7ee'], kota: [3, '#9a9488', '#ffffff'] };
  for (const urut of ['akses', 'kabupaten', 'kota', 'raya', 'tol']) for (const j of D.jalan) { if (j.k !== urut) continue; const [w, tp, isi] = LJ[j.k]; for (const [ww, c] of [[w + 2, tp], [w, isi]]) { g.strokeStyle = c; g.lineWidth = ww * 0.8; jalur(j.p); g.stroke(); } }
  for (const J of D.jembatan) { g.fillStyle = J.besar ? '#c0392b' : '#7f8c8d'; g.beginPath(); g.arc(px(J.x), pz(J.z), J.besar ? 4 : 2.5, 0, 7); g.fill(); }
  // perumahan (kavling)
  for (const K of D.kavling) {
    g.fillStyle = K.ada ? WARNA.perum : 'rgba(255,255,255,.5)'; g.fillRect(px(K.x - K.w / 2), pz(K.z - K.d / 2), K.w * S, K.d * S);
    g.strokeStyle = '#c9a46b'; g.lineWidth = 1; g.strokeRect(px(K.x - K.w / 2), pz(K.z - K.d / 2), K.w * S, K.d * S);
    if (K.ada) { g.fillStyle = '#d9c3a0'; for (let r = 0; r < 4; r++) g.fillRect(px(K.x - K.w / 2 + 3 + r * 9), pz(K.z - K.d / 2 + 4), 4 * S * 2, (K.d - 10) * S); }
  }

  // ---------- label (digambar di atas, ukuran tetap saat zoom)
  const label = [
    ...D.kavling.map(K => ({ x: K.x, z: K.z, t: '🏘️ ' + K.nama, sub: K.blok ? 'Blok ' + K.blok : 'kavling', min: 1.1 })),
    ...D.kavling.map(K => ({ x: K.x, z: K.z, t: '🏘️', min: 0, maks: 1.1 })),
    ...D.lahan.map(L => ({ x: L.x, z: L.z, t: '🚧 ' + L.nama.replace('LAHAN ', ''), min: 0.9 })),
    ...(D.kecamatan || []).map(([n, x, z]) => ({ x, z: z - 14, t: n.toUpperCase(), kec: true, min: 0, maks: 1.6 })),
    { x: 0, z: 0, t: '🏛️ Alun-alun Sidoarjo', min: 0.25 },
    ...(D.bandara ? [{ x: D.bandara.p.reduce((a, p) => a + p[0], 0) / D.bandara.p.length, z: D.bandara.p.reduce((a, p) => a + p[1], 0) / D.bandara.p.length, t: '✈️ Lahan Bandara', min: 0.2 }] : []),
    { x: D.pantai(0) + 60, z: 0, t: '🌊 Selat Madura', min: 0 },
  ];
  // ---------- tampilan (pan/zoom)
  let skala = 1, cx = 0, cz = 0, bukaPenuh = false;   // skala = px layar per px dasar
  function gambar(c, w, h, zoom, pusatX, pusatZ, penuh) {
    const ctx = c.getContext('2d'), dpr = c === mini ? 1 : (devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = WARNA.hutan; ctx.fillRect(0, 0, w, h);
    const ox = w / 2 - px(pusatX) * zoom, oy = h / 2 - pz(pusatZ) * zoom;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(dasar, ox, oy, W0 * zoom, H0 * zoom);
    const ke = (x, z) => [ox + px(x) * zoom, oy + pz(z) * zoom];
    if (penuh) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const L of label) {
        if (zoom < L.min || (L.maks && zoom > L.maks)) continue;
        const [x, y] = ke(L.x, L.z); if (x < -80 || y < -20 || x > w + 80 || y > h + 20) continue;
        ctx.font = L.kec ? '900 12px system-ui, sans-serif' : '800 13px system-ui, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(L.t, x, y); ctx.fillStyle = WARNA.teks; ctx.fillText(L.t, x, y);
        if (L.sub) { ctx.font = '700 11px system-ui, sans-serif'; ctx.strokeText(L.sub, x, y + 14); ctx.fillStyle = '#5b7083'; ctx.fillText(L.sub, x, y + 14); }
      }
    }
    // rumahku
    const rm = rumahSaya && rumahSaya();
    if (rm) { const [x, y] = ke(rm.x, rm.z); ctx.font = (penuh ? 22 : 16) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏠', x, y); }
    // aku
    const p = world.posisiSaya(); const [x, y] = ke(p.x, p.z);
    const t = performance.now() / 1000, r0 = penuh ? 9 : 6;
    ctx.fillStyle = 'rgba(230,57,70,.22)'; ctx.beginPath(); ctx.arc(x, y, r0 + 6 + Math.sin(t * 4) * 3, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(-p.ry + Math.PI);   // arah hadap (kerucut pandang)
    ctx.fillStyle = 'rgba(230,57,70,.35)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r0 * 3.2, Math.PI / 2 - 0.5, Math.PI / 2 + 0.5); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#e63946'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r0, 0, 7); ctx.fill(); ctx.stroke();
    if (penuh) {
      const lb = p.jalan ? 'Kamu di sini' : 'Kamu lihat sini'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(lb, x, y - r0 - 12); ctx.fillStyle = '#e63946'; ctx.fillText(lb, x, y - r0 - 12);
    } else {   // arah utara
      ctx.font = '900 13px system-ui'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('U ▲', w / 2, 14);
    }
  }
  const diPoly = (P, x, z) => { let d = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; };
  function namaTempat(x, z) {   // nama area tempat "aku" berada
    for (const K of D.kavling) if (Math.abs(x - K.x) < K.w / 2 + 2 && Math.abs(z - K.z) < K.d / 2 + 2) return K.ada ? `🏘️ Perumahan ${K.nama} · Blok ${K.blok}` : `🏗️ Kavling ${K.nama}`;
    for (const L of D.lahan) if (Math.abs(x - L.x) < L.w / 2 && Math.abs(z - L.z) < L.d / 2) return '🚧 ' + L.nama.replace('LAHAN', 'Lahan rencana');
    if (D.bandara && diPoly(D.bandara.p, x, z)) return '✈️ Lahan rencana bandara';
    if (D.kota.some(p => x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1)) return x > 32 ? '🏙️ Pusat Kota' : '🏛️ Alun-alun Sidoarjo';
    if (!diPoly(D.batas, x, z)) return x > D.pantai(z) ? '🌊 Selat Madura' : '🌲 Luar kabupaten';
    let kec = null, bd = 1e18; for (const [n, kx, kz] of D.kecamatan || []) { const d = (kx - x) ** 2 + (kz - z) ** 2; if (d < bd) { bd = d; kec = n; } }
    const jenis = x > D.pantai(z) - 200 ? '🐟 Tambak' : '🌾 Sawah';
    return kec ? `${jenis} · Kec. ${kec}` : jenis;
  }
  const lokasi = document.createElement('div'); lokasi.className = 'peta-lokasi'; (document.getElementById('view-peta') || document.body).appendChild(lokasi);
  function ukurPenuh() {
    const r = kv.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    kv.width = Math.round(r.width * dpr); kv.height = Math.round(r.height * dpr);
    return [r.width, r.height];
  }
  let jalan = true, lokTerakhir = '';
  (function loop() {
    if (!jalan) return;
    const p = world.posisiSaya();
    gambar(mini, 260, 260, 1.4, p.x, p.z, false);
    const nm = namaTempat(p.x, p.z); if (nm !== lokTerakhir) { lokTerakhir = nm; lokasi.textContent = '📍 ' + nm; }
    if (bukaPenuh) { const [w, h] = [kv.clientWidth, kv.clientHeight]; gambar(kv, w, h, skala, cx, cz, true); ov.querySelector('.peta-skala').textContent = skalaTeks(); }
    requestAnimationFrame(loop);
  })();
  function skalaTeks() { const m = 100 / (skala * S) * 2; return m >= 1000 ? `100 px ≈ ${(m / 1000).toFixed(1)} km` : `100 px ≈ ${Math.round(m)} m`; }
  function buka() {
    ov.hidden = false; bukaPenuh = true; const [w, h] = ukurPenuh();
    skala = Math.min(w / W0, h / H0) * 2.2; const p = world.posisiSaya(); cx = p.x; cz = p.z;
  }
  const tutup = () => { ov.hidden = true; bukaPenuh = false; };
  mini.onclick = buka;
  ov.querySelector('.peta-tutup').onclick = tutup;
  ov.querySelectorAll('.peta-btn').forEach(b => b.onclick = () => {
    if (b.dataset.a === 'saya') { const p = world.posisiSaya(); cx = p.x; cz = p.z; skala = Math.max(skala, 1.8); }
    else { const r = rumahSaya && rumahSaya(); if (r) { cx = r.x; cz = r.z; skala = Math.max(skala, 2.5); } }
  });
  addEventListener('resize', () => { if (bukaPenuh) ukurPenuh(); });
  // geser / zoom / ketuk
  const sentuh = new Map(); let gerak = 0, jarak0 = 0, skala0 = 1;
  kv.addEventListener('pointerdown', e => { kv.setPointerCapture(e.pointerId); sentuh.set(e.pointerId, [e.clientX, e.clientY]); gerak = 0; if (sentuh.size === 2) { const [a, b] = [...sentuh.values()]; jarak0 = Math.hypot(a[0] - b[0], a[1] - b[1]); skala0 = skala; } });
  kv.addEventListener('pointermove', e => {
    if (!sentuh.has(e.pointerId)) return; const [x0, y0] = sentuh.get(e.pointerId); sentuh.set(e.pointerId, [e.clientX, e.clientY]);
    if (sentuh.size === 2) { const [a, b] = [...sentuh.values()]; skala = Math.min(8, Math.max(0.25, skala0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / (jarak0 || 1))); gerak += 10; return; }
    const dx = e.clientX - x0, dy = e.clientY - y0; gerak += Math.abs(dx) + Math.abs(dy);
    cx -= dx / (skala * S); cz -= dy / (skala * S);
  });
  const lepas = e => {
    if (sentuh.size === 1 && gerak < 6) {   // ketuk = terbang ke sana
      const r = kv.getBoundingClientRect(), x = cx + (e.clientX - r.left - r.width / 2) / (skala * S), z = cz + (e.clientY - r.top - r.height / 2) / (skala * S);
      if (x > A.x0 && x < A.x1 && z > A.z0 && z < A.z1) { world.fokusKe(x, z); tutup(); }
    }
    sentuh.delete(e.pointerId);
  };
  kv.addEventListener('pointerup', lepas); kv.addEventListener('pointercancel', e => sentuh.delete(e.pointerId));
  kv.addEventListener('wheel', e => { e.preventDefault(); skala = Math.min(8, Math.max(0.25, skala * (e.deltaY < 0 ? 1.15 : 0.87))); }, { passive: false });
  return { buka, tutup };
}
