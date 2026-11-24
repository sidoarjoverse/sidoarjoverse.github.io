// Fitur UBAH KARAKTER: warga milih gender, kulit, gaya & warna rambut, pakaian, aksesoris.
// Pratinjau 3D langsung (potretWarga). Disimpan nang warga.look lewat fungsi ubah_karakter (KTP + PIN).
import { potretWarga } from './world.js';
import { PILIH } from './avatar.js';
import * as D from './data.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function bukaKarakter({ saya, pin, onSimpan }) {
  const L = Object.assign({ k: 1, g: saya.gender === 'P' ? 'panjang' : 'pendek', rw: 0, kw: 0, b: 0, c: 0, a: 'polos', bp: 'teal', t: '', kc: false, ku: false, j: false }, saya.look || {});
  let gender = saya.gender === 'P' ? 'P' : 'L';
  const el = document.createElement('div'); el.className = 'rumah-modal';
  el.innerHTML = `<div class="rumah-kotak kr-kotak"><div class="rumah-atas"><div><b>🎨 Ubah Karakter</b><small>${esc(saya.nama)} · pilih sak senengmu</small></div><button type="button" class="rumah-x" aria-label="Tutup">✕</button></div>
    <div class="kr-isi"><div class="kr-pratinjau"><canvas width="220" height="268"></canvas></div><div class="kr-pilih"></div></div>
    <div class="rumah-aksi"><span class="meta kr-pesan"></span><button type="button" class="btn ghost" id="krBatal">Batal</button><button type="button" class="btn oren" id="krSimpan">💾 Simpan karakter</button></div></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), pilih = el.querySelector('.kr-pilih'), pesan = el.querySelector('.kr-pesan');
  const tutup = () => el.remove();
  el.querySelector('.rumah-x').onclick = tutup; el.querySelector('#krBatal').onclick = tutup;
  el.addEventListener('click', e => { if (e.target === el) tutup(); });

  const warna = (judul, key, arr) => `<div class="kr-grup"><b>${judul}</b><div class="kr-opsi">${arr.map((c, i) => `<button type="button" class="kr-warna${L[key] === i ? ' on' : ''}" data-k="${key}" data-v="${i}" style="background:${c}" aria-label="${judul} ${i + 1}"></button>`).join('')}</div></div>`;
  const tombol = (judul, key, arr) => `<div class="kr-grup"><b>${judul}</b><div class="kr-opsi">${arr.map(([v, t]) => `<button type="button" class="kr-chip${L[key] === v ? ' on' : ''}" data-k="${key}" data-s="${v}">${t}</button>`).join('')}</div></div>`;
  const centang = (judul, key) => `<button type="button" class="kr-chip${L[key] ? ' on' : ''}" data-k="${key}" data-b="1">${judul}</button>`;
  function gambarMenu() {
    pilih.innerHTML = `
      <div class="kr-grup"><b>Gender</b><div class="kr-opsi"><button type="button" class="kr-chip${gender === 'L' ? ' on' : ''}" data-gender="L">👦 Lanang</button><button type="button" class="kr-chip${gender === 'P' ? ' on' : ''}" data-gender="P">👧 Wedok</button></div></div>
      ${warna('Warna kulit', 'k', PILIH.kulit)}
      ${tombol('Gaya rambut', 'g', PILIH.gaya)}
      ${L.g === 'kerudung' ? warna('Warna kerudung', 'kw', PILIH.kerudung) : warna('Warna rambut', 'rw', PILIH.rambutWarna)}
      ${tombol('Atasan', 'a', PILIH.atasan)}
      ${L.a === 'batik' ? tombol('Motif batik', 'bp', PILIH.batik.map(b => [b, b])) : warna('Warna baju', 'b', PILIH.baju)}
      ${warna('Warna celana', 'c', PILIH.celana)}
      ${L.g === 'kerudung' ? '' : tombol('Tutup kepala', 't', PILIH.topi)}
      <div class="kr-grup"><b>Aksesoris</b><div class="kr-opsi">${centang('🤓 Kacamata', 'kc')}${centang('🥸 Kumis', 'ku')}${centang('⌚ Jam tangan', 'j')}</div></div>`;
    pilih.querySelectorAll('button').forEach(b => b.onclick = () => {
      if (b.dataset.gender) gender = b.dataset.gender;
      else if (b.dataset.b) L[b.dataset.k] = !L[b.dataset.k];
      else if (b.dataset.s !== undefined) L[b.dataset.k] = b.dataset.s;
      else L[b.dataset.k] = +b.dataset.v;
      gambarMenu(); pratinjau();
    });
  }
  function pratinjau() {
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    try { g.drawImage(potretWarga(Object.assign({}, saya, { gender, look: L }), 220, '#cfe8ef'), 0, 0, 220, 268); } catch (_) {}
  }
  gambarMenu(); pratinjau();
  el.querySelector('#krSimpan').onclick = async () => {
    if (!pin) { pesan.textContent = '⚠️ Ubah karakter mung iso teko HP tempat KTP-mu digawe.'; return; }
    const b = el.querySelector('#krSimpan'); b.disabled = true; pesan.textContent = 'Nyimpen…';
    const look = Object.assign({}, L);
    try { await D.ubahKarakter(saya.kode, pin, gender, look); pesan.textContent = '✅ Karaktermu wis anyar!'; onSimpan && onSimpan({ gender, look }); setTimeout(tutup, 700); }
    catch (e) { pesan.textContent = '⚠️ ' + (/ubah_karakter|function|PGRST202/i.test(e.message) ? 'Fitur durung aktif nang server (admin kudu mlaku 05-karakter.sql).' : e.message); b.disabled = false; }
  };
}
