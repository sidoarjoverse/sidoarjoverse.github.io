// Daftar model bangunan yang tersedia (harus sama dengan TIPE di world.js).
export const TIPE_LIST = [
  { id: 'rumah', label: 'Rumah' }, { id: 'perumahan', label: 'Perumahan (6 rumah)' }, { id: 'gapura', label: 'Gapura' },
  { id: 'alunalun', label: 'Alun-alun' }, { id: 'pendopo', label: 'Pendopo / Balai' }, { id: 'masjid', label: 'Masjid' },
  { id: 'pasar', label: 'Pasar' }, { id: 'sekolah', label: 'Sekolah' }, { id: 'puskesmas', label: 'Puskesmas' },
  { id: 'warung', label: 'Warung' }, { id: 'posronda', label: 'Pos Ronda' }, { id: 'tambak', label: 'Tambak' },
  { id: 'sawah', label: 'Sawah' }, { id: 'candi', label: 'Candi' }, { id: 'tugu', label: 'Tugu' },
  { id: 'lapangan', label: 'Lapangan Bola' }, { id: 'kantor', label: 'Gedung / Kantor' },
];

// Kawasan Perumahan (barat kota): kavling 22 × 36, pintu masuk di sisi +z, 40 rumah per blok
export const KAV_W = 22, KAV_D = 36;
export const KAVLING_PERUMAHAN = [];
for (const cz of [-20, -60]) for (const cx of [-48, -76, -104, -132]) KAVLING_PERUMAHAN.push({ x: cx, z: cz });
// tata letak 40 rumah di dalam kavling (koordinat lokal): 4 baris × 10 rumah, 2 jalan paving
export function tataRumahBlok() {
  const kolom = [[-9.1, 270], [-2.1, 90], [2.1, 270], [9.1, 90]], hasil = [];
  kolom.forEach(([x, rot]) => { for (let i = 0; i < 10; i++) hasil.push({ x, z: 12.4 - i * 3.2, rot }); });
  return hasil;
}
