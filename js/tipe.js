// Daftar model bangunan yang tersedia (harus sama dengan TIPE di world.js).
export const TIPE_LIST = [
  { id: 'rumah', label: 'Rumah' }, { id: 'perumahan', label: 'Perumahan (6 rumah)' }, { id: 'gapura', label: 'Gapura' },
  { id: 'alunalun', label: 'Alun-alun' }, { id: 'pendopo', label: 'Pendopo / Balai' }, { id: 'masjid', label: 'Masjid' },
  { id: 'pasar', label: 'Pasar' }, { id: 'sekolah', label: 'Sekolah' }, { id: 'puskesmas', label: 'Puskesmas' },
  { id: 'warung', label: 'Warung' }, { id: 'posronda', label: 'Pos Ronda' }, { id: 'tambak', label: 'Tambak' },
  { id: 'sawah', label: 'Sawah' }, { id: 'candi', label: 'Candi' }, { id: 'tugu', label: 'Tugu' },
  { id: 'lapangan', label: 'Lapangan Bola' }, { id: 'kantor', label: 'Gedung / Kantor' },
];

// Perumahan warga: 25 kavling (1 kavling = 1 blok = 40 rumah → 1000 rumah), masing-masing di letak asli perumahannya di Sidoarjo.
// Kavling 37 × 54 m, pintu masuk (gapura) di sisi +z menghadap jalan. Rumah berteras, jarak antar rumah 4,6 m.
import { SDA } from './sidoarjo-data.js';
export const KAV_W = 37, KAV_D = 54;
// 25 kavling di letak asli perumahannya di Sidoarjo (data OpenStreetMap; digeser sedikit bila bertabrakan dengan jalan/sungai/kavling lain)
export const KAVLING_PERUMAHAN = SDA.kavling.map(k => ({ x: k.x, z: k.z, n: k.n }));
export const NAMA_PERUMAHAN = SDA.kavling.map(k => k.n);
// tata letak 40 rumah di dalam kavling (koordinat lokal): 4 deret × 10 rumah menghadap 2 jalan paving (x = ±10)
export function tataRumahBlok() {
  const kolom = [[-15.3, 270], [-4.7, 90], [4.7, 270], [15.3, 90]], hasil = [];
  kolom.forEach(([x, rot]) => { for (let i = 0; i < 10; i++) hasil.push({ x, z: 18.5 - i * 4.6, rot }); });
  return hasil;
}

// kendaraan sepaket dengan rumah perumahan (tetap per rumah, dihitung dari id rumah)
export const KENDARAAN = {
  mobil: { label: '🚗 Mobil', bobot: 28 }, motor: { label: '🛵 Motor', bobot: 26 }, pickup: { label: '🛻 Pikap', bobot: 10 },
  becak: { label: '🛺 Becak', bobot: 12 }, gerobak: { label: '🛒 Gerobak', bobot: 12 }, sepeda: { label: '🚲 Sepeda', bobot: 12 },
};
export function kendaraanRumah(id) {
  let h = 2166136261; for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const tot = Object.values(KENDARAAN).reduce((a, k) => a + k.bobot, 0); let x = ((h >>> 0) % 1000) / 1000 * tot;
  for (const [j, k] of Object.entries(KENDARAAN)) { if ((x -= k.bobot) < 0) return j; }
  return 'mobil';
}
