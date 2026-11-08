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
