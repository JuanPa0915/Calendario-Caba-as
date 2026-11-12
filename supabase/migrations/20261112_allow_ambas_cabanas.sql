-- Permite reservas para "Ambas Cabañas" (cabin_id = 'AB').
-- Error original: new row for relation "reservations" violates check constraint "reservations_cabin_id_check"
-- Correr en Supabase > SQL Editor (ya existe la tabla, solo se cambia la restricción).

alter table public.reservations drop constraint if exists reservations_cabin_id_check;

alter table public.reservations
  add constraint reservations_cabin_id_check
  check (cabin_id in ('A', 'B', 'AB'));
