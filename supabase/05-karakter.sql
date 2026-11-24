-- Fitur UBAH KARAKTER: warga milih gender, kulit, rambut, pakaian, aksesoris. Jalankan SEKALI di Supabase → SQL Editor.
-- Pilihan disimpan ringkas (angka/teks pendek) di kolom warga.look. Ganti hanya lewat fungsi ubah_karakter (KTP + PIN).

alter table public.warga add column if not exists look jsonb;
grant select (look) on public.warga to anon, authenticated;

create or replace function public.ubah_karakter(p_kode text, p_pin text, p_gender text, p_look jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare w public.warga;
begin
  select * into w from public.warga where kode = upper(trim(p_kode));
  if not found or w.pin <> upper(trim(p_pin)) then raise exception 'KTP atau PIN salah. Ubah karakter teko HP tempat KTP-mu digawe.'; end if;
  if p_gender not in ('L', 'P') then raise exception 'Gender kudu L utowo P.'; end if;
  if p_look is null or jsonb_typeof(p_look) <> 'object' or octet_length(p_look::text) > 400 then raise exception 'Data karakter ora valid.'; end if;
  update public.warga set look = p_look, gender = p_gender where id = w.id;
  return json_build_object('ok', true);
end $$;
revoke execute on function public.ubah_karakter(text, text, text, jsonb) from public;
grant execute on function public.ubah_karakter(text, text, text, jsonb) to anon, authenticated;
