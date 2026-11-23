-- Buku Puisi Netizen (di depan Museum Benang Merah). Jalankan SEKALI di Supabase → SQL Editor.
-- Warga menulis puisi pakai KTP + PIN (dari HP tempat KTP dibuat). Maks 3 puisi per warga per hari.
-- Admin bisa menyembunyikan puisi: Table Editor → puisi → ubah kolom "tampil" jadi false.

create table if not exists public.puisi (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid references public.warga(id) on delete cascade,
  nama text not null,
  kecamatan text,
  judul text not null,
  isi text not null,
  tampil boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists puisi_terbaru on public.puisi (created_at desc) where tampil;

alter table public.puisi enable row level security;
drop policy if exists "puisi dibaca publik" on public.puisi;
create policy "puisi dibaca publik" on public.puisi for select using (tampil);
-- tidak ada policy insert/update/delete untuk publik: menulis hanya lewat fungsi tulis_puisi di bawah

create or replace function public.tulis_puisi(p_kode text, p_pin text, p_judul text, p_isi text) returns json
language plpgsql security definer set search_path = public as $$
declare w public.warga; n int; j text := trim(coalesce(p_judul, '')); i text := trim(coalesce(p_isi, ''));
begin
  select * into w from public.warga where kode = upper(trim(p_kode));
  if not found or w.pin <> upper(trim(p_pin)) then raise exception 'Nomor KTP atau PIN salah. Tulis puisi dari HP tempat KTP-mu dibuat.'; end if;
  if length(j) < 1 or length(j) > 60 then raise exception 'Judul 1–60 huruf.'; end if;
  if length(i) < 10 or length(i) > 1000 then raise exception 'Isi puisi 10–1000 huruf.'; end if;
  select count(*) into n from public.puisi where warga_id = w.id and created_at > now() - interval '1 day';
  if n >= 3 then raise exception 'Maksimal 3 puisi sedina, rek. Sesuk maneh yo!'; end if;
  insert into public.puisi (warga_id, nama, kecamatan, judul, isi) values (w.id, w.nama, w.kecamatan, j, i);
  return json_build_object('ok', true);
end $$;
grant execute on function public.tulis_puisi(text, text, text, text) to anon, authenticated;
