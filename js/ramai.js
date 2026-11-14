// Mode Ramai: warga yang sedang online saling melihat lewat Supabase Realtime (broadcast, tanpa tabel/SQL).
// Pesan: "pos" (posisi karakter), "chat" (nomor kalimat template, BUKAN teks bebas), "pamit".
import { CONFIG } from './config.js';

export const KALIMAT = [
  'Halo rek! 👋', 'Monggo mampir 🙏', 'Aku teko Kec. {kec}', 'Ayo gawe KTP! 🪪', 'Mlaku-mlaku bareng yuk 🚶',
  'Wkwkwk 😂', 'Mantap pol! 🔥', 'Matur suwun 🙏', 'Sesuk bangun opo? 🏗️', 'Pamit sik ya 👋',
];
export const EMOTE = ['❤️', '😂', '👍', '😮', '🎉', '🔥'];
export const teksChat = (i, w) => {
  if (i >= 100 && i < 100 + EMOTE.length) return EMOTE[i - 100];
  const k = KALIMAT[i]; return k ? k.replace('{kec}', (w && w.kecamatan) || '?') : null;
};

const UJI = new URLSearchParams(location.search).get('ramai');   // ?ramai=uji → kanal terpisah untuk pengujian
const TOPIK = `realtime:ramai-${CONFIG.KOTA_ID}${UJI ? '-' + UJI.replace(/[^a-z0-9]/gi, '') : ''}`;
const bersih = s => String(s || '').slice(0, 24);
// hanya data KTP yang memang publik (sama dengan yang tampil di peta)
const ringkas = w => ({ kode: bersih(w.kode), nama: bersih(w.nama), gender: w.gender === 'P' ? 'P' : 'L', kecamatan: bersih(w.kecamatan), pekerjaan: bersih(w.pekerjaan) });

export function mulaiRamai({ world, saya, onJumlah }) {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) return null;
  let ws = null, ref = 0, siap = false, tutup = false, jeda = 1000;
  const terlihat = new Map();   // kode -> waktu terakhir terdengar
  const kirim = (event, payload) => {
    if (!siap) return;
    try { ws.send(JSON.stringify({ topic: TOPIK, event: 'broadcast', payload: { type: 'broadcast', event, payload }, ref: String(++ref) })); } catch (_) {}
  };
  function sambung() {
    const url = CONFIG.SUPABASE_URL.replace(/^http/, 'ws') + `/realtime/v1/websocket?apikey=${encodeURIComponent(CONFIG.SUPABASE_ANON_KEY)}&vsn=1.0.0`;
    ws = new WebSocket(url);
    ws.onopen = () => { jeda = 1000; ws.send(JSON.stringify({ topic: TOPIK, event: 'phx_join', payload: { config: { broadcast: { self: false } } }, ref: String(++ref) })); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (m.event === 'phx_reply' && m.topic === TOPIK && m.payload && m.payload.status === 'ok') siap = true;
      if (m.event !== 'broadcast' || !m.payload) return;
      terima(m.payload.event, m.payload.payload || {});
    };
    ws.onclose = () => { siap = false; if (!tutup) { setTimeout(sambung, jeda); jeda = Math.min(jeda * 2, 30000); } };
    ws.onerror = () => {};
  }
  function terima(ev, d) {
    const w = d.w && ringkas(d.w); if (!w || !w.kode || (saya() && w.kode === saya().kode)) return;
    if (ev === 'pos' && Number.isFinite(+d.x) && Number.isFinite(+d.z)) {
      terlihat.set(w.kode, Date.now());
      world.tamu(w.kode, { w, x: Math.max(-40, Math.min(40, +d.x)), z: Math.max(-40, Math.min(40, +d.z)), ry: +d.ry || 0, j: !!d.j });
      hitung();
    } else if (ev === 'chat') {
      const t = teksChat(+d.i, w); if (t && terlihat.has(w.kode)) world.gelembung(w.kode, t);
    } else if (ev === 'pamit') { terlihat.delete(w.kode); world.tamuPergi(w.kode); hitung(); }
  }
  let nTerakhir = -1;
  function hitung() { const n = terlihat.size + (world.sedangMain() ? 1 : 0); if (n !== nTerakhir) { nTerakhir = n; onJumlah && onJumlah(n); } }
  // kirim posisi sendiri saat jalan-jalan: 1×/detik saat bergerak, tiap 8 detik saat diam (hemat kuota Realtime)
  let akhir = { x: 1e9, z: 0, ry: 0, t: 0 };
  setInterval(() => {
    const st = world.statusPemain(), s = saya();
    if (!st || !s) return;
    const now = Date.now(), gerak = Math.hypot(st.x - akhir.x, st.z - akhir.z) > 0.05 || Math.abs(st.ry - akhir.ry) > 0.1;
    if ((gerak && now - akhir.t > 1000) || now - akhir.t > 8000) {
      kirim('pos', { w: ringkas(s), x: +st.x.toFixed(2), z: +st.z.toFixed(2), ry: +st.ry.toFixed(2), j: st.j });
      akhir = { x: st.x, z: st.z, ry: st.ry, t: now };
    }
  }, 200);
  // warga yang tidak terdengar 10 detik dianggap pergi; jaga koneksi tetap hidup
  setInterval(() => { const now = Date.now(); for (const [k, t] of terlihat) if (now - t > 20000) { terlihat.delete(k); world.tamuPergi(k); } hitung(); }, 2000);
  setInterval(() => { if (siap) try { ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) })); } catch (_) {} }, 25000);
  addEventListener('pagehide', () => { if (saya() && world.sedangMain()) kirim('pamit', { w: ringkas(saya()) }); });
  sambung();
  let chatTerakhir = 0;
  return {
    chat(i) {
      const s = saya(), t = teksChat(i, s); if (!s || !t || !world.sedangMain()) return false;
      if (Date.now() - chatTerakhir < 1500) return false;
      chatTerakhir = Date.now(); world.gelembung(null, t); kirim('chat', { w: ringkas(s), i }); return true;
    },
    pamit() { const s = saya(); if (s) kirim('pamit', { w: ringkas(s) }); akhir.t = 0; hitung(); },
    jumlah: () => terlihat.size + (world.sedangMain() ? 1 : 0),
  };
}
