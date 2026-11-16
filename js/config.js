// Pengaturan SidoarjoVerse.
// Kosongkan SUPABASE_URL untuk MODE DEMO (data disimpan di browser saja).
// Isi dengan Project URL & anon public key dari Supabase (Settings > API)
// supaya KTP warga dan perubahan admin tersimpan online untuk semua orang.
export const CONFIG = {
  SUPABASE_URL: 'https://oskaiwpaipoexybrbmuw.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_TA1gz4gbJa040D-QDcETMA_rkrHls2p',
  KOTA_ID: 'sidoarjo',
  // Hanya untuk mode demo. Di mode Supabase, admin login dengan email & password Supabase.
  DEMO_ADMIN_PASSWORD: 'admin',
  // Berapa karakter warga (dari KTP terbaru) yang ditampilkan berjalan di peta.
  MAKS_WARGA_DI_PETA: 30,
};
