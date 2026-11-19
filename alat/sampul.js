// Buat cover/thumbnail video 1080×1920 gaya "episode": label kuning, chip tag, judul besar dua warna, latar adegan 3D.
// Pakai: node alat/sampul.js video/<nama> '<json>'   json: {bg, badgeAtas, badge, chips:[...], judul:"BARIS 1<br><span>KUNING</span>"}
// bg = nama gambar di folder video (mis. frame hasil render). Hasil: video/<nama>/sampul.jpg  (server lokal port 8080 harus jalan)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = process.argv[2], q = JSON.parse(process.argv[3]);
  q.bg = `/${dir}/${q.bg}`;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(`http://localhost:8080/alat/sampul.html#${encodeURIComponent(JSON.stringify(q))}`); await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(__dirname, '..', dir, 'sampul.jpg'), type: 'jpeg', quality: 92 });
  await b.close(); console.log('sampul:', dir + '/sampul.jpg');
})();
