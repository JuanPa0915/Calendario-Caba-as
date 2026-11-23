-- Agrega número de adultos y niños (opcionales) a las reservas.
-- Correr en Supabase > SQL Editor ANTES de usar la nueva versión de la app.

alter table public.reservations add column if not exists adults integer;
alter table public.reservations add column if not exists children integer;

alter table public.reservations drop constraint if exists reservations_adults_check;
alter table public.reservations add constraint reservations_adults_check check (adults is null or adults >= 0);

alter table public.reservations drop constraint if exists reservations_children_check;
alter table public.reservations add constraint reservations_children_check check (children is null or children >= 0);
