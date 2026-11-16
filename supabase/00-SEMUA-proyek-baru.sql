-- SidoarjoVerse: SEMUA tabel sekaligus untuk proyek Supabase BARU.
-- Supabase > SQL Editor > New query > tempel seluruh isi file ini > Run (sekali saja).

-- SidoarjoVerse: skema database Supabase.
-- Jalankan sekali di Supabase > SQL Editor > New query > tempel > Run.

-- 1) Data kota (bangunan, info, donasi, dll) disimpan sebagai satu JSON.
create table if not exists public.kota (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) Daftar email yang boleh mengedit lewat admin.html
create table if not exists public.admins (
  email text primary key
);

-- 3) KTP warga
create table if not exists public.warga (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null default ('SDA-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))),
  nama text not null check (nama ~ '^[A-Za-z0-9 ._-]{2,20}$'),
  pekerjaan text not null check (char_length(pekerjaan) between 1 and 30),
  gender text not null default '-' check (gender in ('L', 'P', '-')),
  kecamatan text not null check (char_length(kecamatan) between 1 and 30),
  created_at timestamptz not null default now()
);
create index if not exists warga_created_idx on public.warga (created_at desc);
create index if not exists warga_kec_idx on public.warga (kecamatan);

-- Klasemen kecamatan
create or replace view public.klasemen_kecamatan with (security_invoker = true) as
  select kecamatan,
         count(*)::int as total,
         count(*) filter (where created_at > now() - interval '7 days')::int as minggu_ini
  from public.warga
  group by kecamatan;

-- Fungsi bantu: apakah user yang login adalah admin?
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = auth.jwt() ->> 'email');
$$;

-- Row Level Security
alter table public.kota enable row level security;
alter table public.admins enable row level security;
alter table public.warga enable row level security;

drop policy if exists "kota dibaca semua" on public.kota;
create policy "kota dibaca semua" on public.kota for select using (true);
drop policy if exists "kota ditulis admin" on public.kota;
create policy "kota ditulis admin" on public.kota for insert to authenticated with check (public.is_admin());
drop policy if exists "kota diubah admin" on public.kota;
create policy "kota diubah admin" on public.kota for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "warga dibaca semua" on public.warga;
create policy "warga dibaca semua" on public.warga for select using (true);
drop policy if exists "warga daftar" on public.warga;
create policy "warga daftar" on public.warga for insert to anon, authenticated with check (true);
drop policy if exists "warga dihapus admin" on public.warga;
create policy "warga dihapus admin" on public.warga for delete to authenticated using (public.is_admin());

-- Cegah spam: maksimal 30 KTP baru per menit untuk seluruh situs.
create or replace function public.batas_daftar() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.warga where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Pendaftaran sedang ramai, coba lagi sebentar lagi.';
  end if;
  return new;
end $$;
drop trigger if exists warga_batas on public.warga;
create trigger warga_batas before insert on public.warga for each row execute function public.batas_daftar();

-- Baris awal kota (isi data akan ditulis pertama kali saat admin menekan Simpan).
insert into public.kota (id, data) values ('sidoarjo', '{}'::jsonb) on conflict (id) do nothing;

-- GANTI dengan email admin kamu (akun dibuat di Authentication > Users > Add user):
-- insert into public.admins (email) values ('emailkamu@contoh.com');


-- SidoarjoVerse: fitur PEMILU + PIN KTP + jabatan.
-- Jalankan SEKALI di Supabase > SQL Editor (setelah schema.sql). Aman dijalankan ulang.

-- 1) PIN rahasia per KTP (hanya pemilik KTP yang tahu; dipakai untuk vote)
create or replace function public.acak_pin() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;
alter table public.warga add column if not exists pin text not null default public.acak_pin();

-- Kolom PIN tidak boleh dibaca publik: izin baca per kolom.
revoke select, insert, update on public.warga from anon, authenticated;
grant select (id, kode, nama, pekerjaan, gender, kecamatan, created_at) on public.warga to anon, authenticated;
grant delete on public.warga to authenticated;

-- Pendaftaran KTP lewat fungsi (mengembalikan PIN sekali ke pemiliknya)
drop policy if exists "warga daftar" on public.warga;
create or replace function public.daftar_warga(p_nama text, p_pekerjaan text, p_gender text, p_kecamatan text)
returns json language plpgsql security definer set search_path = public as $$
declare w public.warga;
begin
  insert into public.warga (nama, pekerjaan, gender, kecamatan)
  values (trim(regexp_replace(p_nama, '\s+', ' ', 'g')), p_pekerjaan, coalesce(p_gender, '-'), p_kecamatan)
  returning * into w;
  return row_to_json(w);
end $$;

create or replace function public.cek_pin(p_kode text, p_pin text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.warga where kode = upper(trim(p_kode)) and pin = upper(trim(p_pin)));
$$;

-- 2) Pemilu & kandidat
create table if not exists public.pemilu (
  id uuid primary key default gen_random_uuid(),
  judul text not null check (char_length(judul) between 2 and 80),
  jabatan text not null check (char_length(jabatan) between 2 and 40),   -- label pemenang, mis. "Ketua RT Blok A"
  kecamatan text,                                                        -- isi = hanya warga kecamatan ini yang boleh vote
  status text not null default 'draft' check (status in ('draft', 'daftar', 'voting', 'selesai')),
  mulai timestamptz,
  selesai timestamptz,
  ket text,
  pemenang uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.kandidat (
  id uuid primary key default gen_random_uuid(),
  pemilu_id uuid not null references public.pemilu(id) on delete cascade,
  warga_id uuid references public.warga(id) on delete set null,
  nomor int not null default 1,
  nama text not null check (char_length(nama) between 1 and 40),
  akun text,
  visi text,
  created_at timestamptz not null default now()
);
create table if not exists public.suara (
  pemilu_id uuid not null references public.pemilu(id) on delete cascade,
  warga_id uuid not null references public.warga(id) on delete cascade,
  kandidat_id uuid not null references public.kandidat(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pemilu_id, warga_id)
);
create index if not exists suara_kandidat_idx on public.suara (kandidat_id);

alter table public.pemilu enable row level security;
alter table public.kandidat enable row level security;
alter table public.suara enable row level security;

drop policy if exists "pemilu dibaca" on public.pemilu;
create policy "pemilu dibaca" on public.pemilu for select using (status <> 'draft' or public.is_admin());
drop policy if exists "pemilu admin" on public.pemilu;
create policy "pemilu admin" on public.pemilu for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kandidat dibaca" on public.kandidat;
create policy "kandidat dibaca" on public.kandidat for select using (
  exists (select 1 from public.pemilu p where p.id = pemilu_id and (p.status <> 'draft' or public.is_admin())));
drop policy if exists "kandidat admin" on public.kandidat;
create policy "kandidat admin" on public.kandidat for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Suara bersifat rahasia: publik hanya melihat jumlah (lewat view hasil_pemilu).
drop policy if exists "suara admin" on public.suara;
create policy "suara admin" on public.suara for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.suara from anon, authenticated;

-- Hasil (jumlah suara per kandidat). Berjalan sebagai pemilik view agar bisa menghitung suara rahasia.
create or replace view public.hasil_pemilu as
  select k.pemilu_id, k.id as kandidat_id, count(s.warga_id)::int as suara
  from public.kandidat k
  join public.pemilu p on p.id = k.pemilu_id and p.status <> 'draft'
  left join public.suara s on s.kandidat_id = k.id
  group by k.pemilu_id, k.id;
grant select on public.hasil_pemilu to anon, authenticated;

-- Pejabat aktif: pemenang pemilu terakhir per jabatan.
create or replace view public.pejabat with (security_invoker = true) as
  select distinct on (p.jabatan) p.jabatan, p.id as pemilu_id, k.nama, k.akun, k.warga_id, w.kode, p.selesai
  from public.pemilu p
  join public.kandidat k on k.id = p.pemenang
  left join public.warga w on w.id = k.warga_id
  where p.status = 'selesai'
  order by p.jabatan, coalesce(p.selesai, p.created_at) desc;
grant select on public.pejabat to anon, authenticated;

-- 3) Memberi suara: 1 KTP = 1 suara per pemilu
create or replace function public.vote(p_kode text, p_pin text, p_kandidat uuid) returns json
language plpgsql security definer set search_path = public as $$
declare w public.warga; k public.kandidat; p public.pemilu;
begin
  select * into w from public.warga where kode = upper(trim(p_kode));
  if not found or w.pin <> upper(trim(p_pin)) then raise exception 'Nomor KTP atau PIN salah.'; end if;
  select * into k from public.kandidat where id = p_kandidat;
  if not found then raise exception 'Kandidat tidak ditemukan.'; end if;
  select * into p from public.pemilu where id = k.pemilu_id;
  if p.status <> 'voting' or (p.mulai is not null and now() < p.mulai) or (p.selesai is not null and now() > p.selesai) then
    raise exception 'Voting belum dibuka atau sudah ditutup.';
  end if;
  if p.kecamatan is not null and p.kecamatan <> w.kecamatan then
    raise exception 'Pemilihan ini khusus warga Kec. %.', p.kecamatan;
  end if;
  if p.mulai is not null and w.created_at > p.mulai then
    raise exception 'KTP-mu dibuat setelah voting dibuka. Ikut pemilihan berikutnya, ya!';
  end if;
  insert into public.suara (pemilu_id, warga_id, kandidat_id) values (p.id, w.id, k.id)
    on conflict (pemilu_id, warga_id) do nothing;
  if not found then raise exception 'Kamu sudah memilih di pemilihan ini.'; end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.pilihanku(p_kode text, p_pin text, p_pemilu uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select s.kandidat_id from public.suara s join public.warga w on w.id = s.warga_id
  where s.pemilu_id = p_pemilu and w.kode = upper(trim(p_kode)) and w.pin = upper(trim(p_pin));
$$;

revoke execute on function public.daftar_warga, public.cek_pin, public.vote, public.pilihanku from public;
grant execute on function public.daftar_warga, public.cek_pin, public.vote, public.pilihanku to anon, authenticated;


-- SidoarjoVerse: fitur RUMAHKU (warga menempati rumah di peta).
-- Jalankan SEKALI di Supabase > SQL Editor, SETELAH 02-pemilu.sql. Aman dijalankan ulang.

-- 1) KTP lama (dibuat sebelum ada PIN) boleh mengambil PIN-nya SATU KALI dari HP-nya.
--    Hanya berlaku untuk KTP yang sudah ada saat file ini pertama dijalankan; KTP baru selalu dapat PIN saat dibuat.
alter table public.warga add column if not exists pin_terbuka boolean;
update public.warga set pin_terbuka = true where pin_terbuka is null;
alter table public.warga alter column pin_terbuka set default false;
update public.warga set pin_terbuka = false where pin_terbuka is null;
alter table public.warga alter column pin_terbuka set not null;

create or replace function public.klaim_pin(p_kode text) returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  update public.warga set pin_terbuka = false
  where kode = upper(trim(p_kode)) and pin_terbuka
  returning pin into v;
  return v;   -- null = PIN sudah pernah diambil / KTP baru
end $$;

-- 2) Penghuni rumah: 1 rumah = 1 warga, 1 warga = 1 rumah
create table if not exists public.rumah_warga (
  rumah_id text primary key check (char_length(rumah_id) between 1 and 40),
  warga_id uuid not null unique references public.warga(id) on delete cascade,
  sejak timestamptz not null default now()
);
alter table public.rumah_warga enable row level security;
drop policy if exists "rumah dibaca semua" on public.rumah_warga;
create policy "rumah dibaca semua" on public.rumah_warga for select using (true);
drop policy if exists "rumah dihapus admin" on public.rumah_warga;
create policy "rumah dihapus admin" on public.rumah_warga for delete to authenticated using (public.is_admin());
revoke insert, update, delete on public.rumah_warga from anon, authenticated;
grant select on public.rumah_warga to anon, authenticated;
grant delete on public.rumah_warga to authenticated;

-- daftar penghuni untuk peta (hanya data KTP yang memang publik)
create or replace view public.penghuni with (security_invoker = true) as
  select r.rumah_id, r.sejak, w.kode, w.nama, w.gender, w.kecamatan, w.pekerjaan
  from public.rumah_warga r join public.warga w on w.id = r.warga_id;
grant select on public.penghuni to anon, authenticated;

-- 3) Menempati / meninggalkan rumah (wajib nomor KTP + PIN)
create or replace function public.tempati_rumah(p_kode text, p_pin text, p_rumah text) returns json
language plpgsql security definer set search_path = public as $$
declare w public.warga; ada boolean; pemilik uuid;
begin
  select * into w from public.warga where kode = upper(trim(p_kode));
  if not found or w.pin <> upper(trim(p_pin)) then raise exception 'KTP tidak dikenali. Tempati rumah dari HP tempat KTP-mu dibuat.'; end if;
  select exists (
    select 1 from public.kota k, jsonb_array_elements(coalesce(k.data->'bangunan', '[]'::jsonb)) b
    where b->>'id' = p_rumah and (b->>'huni')::boolean is true and coalesce(b->>'status', '') = 'selesai'
  ) into ada;
  if not ada then raise exception 'Rumah ini tidak bisa ditempati.'; end if;
  select warga_id into pemilik from public.rumah_warga where rumah_id = p_rumah for update;
  if found and pemilik <> w.id then raise exception 'Rumah ini sudah ditempati warga lain.'; end if;
  if found then return json_build_object('ok', true, 'rumah', p_rumah); end if;
  delete from public.rumah_warga where warga_id = w.id;            -- pindah rumah
  insert into public.rumah_warga (rumah_id, warga_id) values (p_rumah, w.id);
  return json_build_object('ok', true, 'rumah', p_rumah);
exception when unique_violation then
  raise exception 'Rumah ini baru saja ditempati warga lain.';
end $$;

create or replace function public.tinggalkan_rumah(p_kode text, p_pin text) returns json
language plpgsql security definer set search_path = public as $$
declare w public.warga;
begin
  select * into w from public.warga where kode = upper(trim(p_kode));
  if not found or w.pin <> upper(trim(p_pin)) then raise exception 'KTP tidak dikenali.'; end if;
  delete from public.rumah_warga where warga_id = w.id;
  return json_build_object('ok', true);
end $$;

revoke execute on function public.klaim_pin, public.tempati_rumah, public.tinggalkan_rumah from public;
grant execute on function public.klaim_pin, public.tempati_rumah, public.tinggalkan_rumah to anon, authenticated;


-- Data kota awal (salinan terakhir, 1000 rumah diringkas). Tidak menimpa kalau sudah ada.
insert into public.kota (id, data) values ('sidoarjo', '{"day":4,"akun":{"tiktok":"https://www.tiktok.com/@sidoarjoverse","youtube":"https://www.youtube.com/@jatimverse","facebook":"","instagram":"https://www.instagram.com/sidoarjoverse/"},"ayam":9,"info":[{"id":"i1","isi":"Halo! Aku Cak Darjo, warga pertama dan satu-satunya di SidoarjoVerse.\n\nKota ini masih tanah kosong. Semua yang dibangun di sini ditentukan dari komentar kalian:\n- Follow = jadi warga\n- Komen usulan bangunan di postingan terbaru\n- Komen dengan like terbanyak dibangun besok\n\nBikin KTP supaya karaktermu ikut jalan-jalan di peta.","pin":true,"judul":"DAY 0: Kota masih kosong","label":"Pengumuman","tanggal":"2026-11-06"}],"kota":"Sidoarjo","nama":"SidoarjoVerse","jalan":true,"papan":{"isi":"Selamat datang di SidoarjoVerse!\nFollow = jadi warga\nKomen like terbanyak = besok dibangun\nBikin KTP-mu di tab KTP","judul":"PENGUMUMAN","tampil":true},"berita":["DAY 1: SidoarjoVerse wis aspalan. Wargane wis akeh.","Follow = jadi warga. Komen dengan like terbanyak dibangun besok.","Mau bangun apa duluan? Tulis di kolom komen!"],"donasi":[{"id":"d01m7pa","ket":"❤️ MATUR NUWUN, WARGA BAIK!\n\nTerima kasih sudah ikut mendukung pembangunan SidoarjoVerse!\n\nSetiap dukungan dari sampeyan bukan sekadar donasi, tapi ikut membantu mewujudkan kota virtual yang kita bangun bersama.\n\nBerkat kebaikanmu, Cak Darjo jadi makin semangat membangun kota ini. Akhirnya, gak cuma punya warga, tapi juga punya orang-orang baik di belakangnya. 🥹\n\nSemoga kebaikanmu dibalas dengan berlipat-lipat kebaikan.\n\nSidoarjoVerse tumbuh karena kita semua.\n\nMatur nuwun sanget, rek! ❤️🏙️\n\n— Cak Darjo, Wali Kota SidoarjoVerse","link":"https://saweria.co/sidoarjoverse","judul":"Program Baru","target":100000,"tombol":"Donasi di sini","terkumpul":0}],"maskot":{"nama":"Cak Darjo","jadwal":[{"ket":"Ayo, Ajaken koncomu, Rek!","lok":"keliling","mulai":"05:00","selesai":"22:00"},{"ket":"Jaga malam sendirian. Sepi, rek.","lok":"keliling","mulai":"22:00","selesai":"05:00"}],"jabatan":"Wali Kota","kalimat":["Monggo, selamat datang di SidoarjoVerse!","Kota iki sik kosong. Sampeyan pengen dibangun apa?","Komen paling banyak like, besok tak bangun.","Ojok lali bikin KTP, biar sampeyan ikut jalan-jalan.","Saiki wargane cuma aku. Ayo dadi warga!"]},"tagline":"Kota Delta yang dibangun dari komen kamu","bangunan":[{"x":-57.1,"z":-7.6,"id":"rmh-B1","no":1,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 1","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-57.1,"z":-10.8,"id":"rmh-B2","no":2,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 2","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-57.1,"z":-14,"id":"rmh-B3","no":3,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 3","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-57.1,"z":-17.200000000000003,"id":"rmh-B4","no":4,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 4","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-57.1,"z":-20.4,"id":"rmh-B5","no":5,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 5","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-57.1,"z":-23.6,"id":"rmh-B6","no":6,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 6","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-57.1,"z":-26.800000000000004,"id":"rmh-B7","no":7,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 7","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-57.1,"z":-30,"id":"rmh-B8","no":8,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 8","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-57.1,"z":-33.2,"id":"rmh-B9","no":9,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 9","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-57.1,"z":-36.4,"id":"rmh-B10","no":10,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 10","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-50.1,"z":-7.6,"id":"rmh-B11","no":11,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 11","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-50.1,"z":-10.8,"id":"rmh-B12","no":12,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 12","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-50.1,"z":-14,"id":"rmh-B13","no":13,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 13","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-50.1,"z":-17.200000000000003,"id":"rmh-B14","no":14,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 14","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-50.1,"z":-20.4,"id":"rmh-B15","no":15,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 15","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-50.1,"z":-23.6,"id":"rmh-B16","no":16,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 16","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-50.1,"z":-26.800000000000004,"id":"rmh-B17","no":17,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 17","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-50.1,"z":-30,"id":"rmh-B18","no":18,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 18","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-50.1,"z":-33.2,"id":"rmh-B19","no":19,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 19","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-50.1,"z":-36.4,"id":"rmh-B20","no":20,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 20","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-45.9,"z":-7.6,"id":"rmh-B21","no":21,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 21","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-45.9,"z":-10.8,"id":"rmh-B22","no":22,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 22","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-45.9,"z":-14,"id":"rmh-B23","no":23,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 23","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-45.9,"z":-17.200000000000003,"id":"rmh-B24","no":24,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 24","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-45.9,"z":-20.4,"id":"rmh-B25","no":25,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 25","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-45.9,"z":-23.6,"id":"rmh-B26","no":26,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 26","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-45.9,"z":-26.800000000000004,"id":"rmh-B27","no":27,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 27","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-45.9,"z":-30,"id":"rmh-B28","no":28,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 28","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-45.9,"z":-33.2,"id":"rmh-B29","no":29,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 29","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-45.9,"z":-36.4,"id":"rmh-B30","no":30,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":270,"blok":"B","huni":true,"nama":"Rumah Blok B No. 30","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-38.9,"z":-7.6,"id":"rmh-B31","no":31,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 31","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-38.9,"z":-10.8,"id":"rmh-B32","no":32,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 32","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-38.9,"z":-14,"id":"rmh-B33","no":33,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 33","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-38.9,"z":-17.200000000000003,"id":"rmh-B34","no":34,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 34","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-38.9,"z":-20.4,"id":"rmh-B35","no":35,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 35","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-38.9,"z":-23.6,"id":"rmh-B36","no":36,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 36","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-38.9,"z":-26.800000000000004,"id":"rmh-B37","no":37,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 37","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-38.9,"z":-30,"id":"rmh-B38","no":38,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 38","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-38.9,"z":-33.2,"id":"rmh-B39","no":39,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 39","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100},{"x":-38.9,"z":-36.4,"id":"rmh-B40","no":40,"day":"2","ket":"Perumahan Safira Garden, Blok B. Ketuk untuk masuk atau menempati.","rot":90,"blok":"B","huni":true,"nama":"Rumah Blok B No. 40","tipe":"rumah","status":"selesai","tampil":true,"usulan":"","kawasan":"perumahan","progres":100}],"follower":8000,"day_mulai":"2026-11-08","kecamatan":["Sidoarjo","Buduran","Candi","Porong","Krembung","Tulangan","Tanggulangin","Jabon","Krian","Balongbendo","Wonoayu","Tarik","Prambon","Taman","Waru","Gedangan","Sedati","Sukodono"],"pekerjaan":["Petambak","Petani","Pedagang","Pengrajin Tas","Pembatik","Guru","Pelajar","Mahasiswa","Nakes","Ojol","Karyawan","Santri","Konten Kreator","Wiraswasta","Bank Plecit"],"perumahan":[{"blok":"B","nama":"Safira Garden","kavling":0},{"blok":"C","nama":"Pondok Jati","kavling":1},{"blok":"D","nama":"Taman Pinang Indah","kavling":2},{"blok":"E","nama":"Pondok Mutiara","kavling":3},{"blok":"F","nama":"Puri Surya Jaya","kavling":4},{"blok":"G","nama":"Gading Fajar","kavling":5},{"blok":"H","nama":"Deltasari Indah","kavling":6},{"blok":"I","nama":"Pondok Tjandra Indah","kavling":7},{"blok":"J","nama":"Sidokare Indah","kavling":8},{"blok":"K","nama":"Magersari Permai","kavling":9},{"blok":"L","nama":"Kahuripan Nirwana","kavling":10},{"blok":"M","nama":"Bumi Citra Fajar","kavling":11},{"blok":"N","nama":"Griya Candramas","kavling":12},{"blok":"O","nama":"Wisma Tropodo","kavling":13},{"blok":"P","nama":"Citra Harmoni","kavling":14},{"blok":"Q","nama":"Graha Kota","kavling":15},{"blok":"R","nama":"Mutiara Citra Graha","kavling":16},{"blok":"S","nama":"Puri Indah","kavling":17},{"blok":"T","nama":"Pucang Indah","kavling":18},{"blok":"U","nama":"Taman Anggun Sejahtera","kavling":19},{"blok":"V","nama":"Candiloka","kavling":20},{"blok":"W","nama":"Pondok Wage Indah","kavling":21},{"blok":"X","nama":"Bluru Permai","kavling":22},{"blok":"Y","nama":"Juanda Harapan Permai","kavling":23},{"blok":"Z","nama":"Taman Jenggala","kavling":24}],"diperbarui":"2026-11-11 15:07","rumahMassal":{"C":40,"D":40,"E":40,"F":40,"G":40,"H":40,"I":40,"J":40,"K":40,"L":40,"M":40,"N":40,"O":40,"P":40,"Q":40,"R":40,"S":40,"T":40,"U":40,"V":40,"W":40,"X":40,"Y":40,"Z":40}}'::jsonb) on conflict (id) do nothing;
