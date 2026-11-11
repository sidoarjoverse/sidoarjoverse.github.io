// Daftar model bangunan yang tersedia (harus sama dengan TIPE di world.js).
export const TIPE_LIST = [
  { id: 'rumah', label: 'Rumah' }, { id: 'perumahan', label: 'Perumahan (6 rumah)' }, { id: 'gapura', label: 'Gapura' },
  { id: 'alunalun', label: 'Alun-alun' }, { id: 'pendopo', label: 'Pendopo / Balai' }, { id: 'masjid', label: 'Masjid' },
  { id: 'pasar', label: 'Pasar' }, { id: 'sekolah', label: 'Sekolah' }, { id: 'puskesmas', label: 'Puskesmas' },
  { id: 'warung', label: 'Warung' }, { id: 'posronda', label: 'Pos Ronda' }, { id: 'tambak', label: 'Tambak' },
  { id: 'sawah', label: 'Sawah' }, { id: 'candi', label: 'Candi' }, { id: 'tugu', label: 'Tugu' },
  { id: 'lapangan', label: 'Lapangan Bola' }, { id: 'kantor', label: 'Gedung / Kantor' },
];

// Kawasan Perumahan (barat kota): 25 kavling (5 × 5), 1 kavling = 1 blok = 40 rumah → 1000 rumah.
// Kavling 37 × 54 m, pintu masuk (gapura) di sisi +z menghadap jalan. Rumah berteras, jarak antar rumah 4,6 m.
export const KAV_W = 37, KAV_D = 54;
export const KAV_KOLOM = [-62, -106, -150, -194, -238], KAV_BARIS = [-30, -92, -154, -216, -278];
export const KAVLING_PERUMAHAN = [];
for (const cz of KAV_BARIS) for (const cx of KAV_KOLOM) KAVLING_PERUMAHAN.push({ x: cx, z: cz });
// nama bawaan: 1 kavling (40 rumah) = 1 perumahan, nama diambil dari perumahan-perumahan di Sidoarjo
export const NAMA_PERUMAHAN = ['Safira Garden', 'Pondok Jati', 'Taman Pinang Indah', 'Pondok Mutiara', 'Puri Surya Jaya',
  'Gading Fajar', 'Deltasari Indah', 'Pondok Tjandra Indah', 'Sidokare Indah', 'Magersari Permai',
  'Kahuripan Nirwana', 'Bumi Citra Fajar', 'Griya Candramas', 'Wisma Tropodo', 'Citra Harmoni',
  'Graha Kota', 'Mutiara Citra Graha', 'Puri Indah', 'Pucang Indah', 'Taman Anggun Sejahtera',
  'Candiloka', 'Pondok Wage Indah', 'Bluru Permai', 'Juanda Harapan Permai', 'Taman Jenggala'];
// tata letak 40 rumah di dalam kavling (koordinat lokal): 4 deret × 10 rumah menghadap 2 jalan paving (x = ±10)
export function tataRumahBlok() {
  const kolom = [[-15.3, 270], [-4.7, 90], [4.7, 270], [15.3, 90]], hasil = [];
  kolom.forEach(([x, rot]) => { for (let i = 0; i < 10; i++) hasil.push({ x, z: 18.5 - i * 4.6, rot }); });
  return hasil;
}
