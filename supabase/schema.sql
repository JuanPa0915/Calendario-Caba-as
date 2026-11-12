-- 1) Tabla principal
create table if not exists public.reservations (
  id text primary key, -- ej: "resabc123" (lo genera tu app)
  cabin_id text not null check (cabin_id in ('A', 'B', 'AB')), -- A = Blanca, B = Madera, AB = Ambas
  guest_name text not null,
  phone text not null default '',
  check_in date not null,
  check_out date not null,
  total_price numeric(12,0) not null default 0 check (total_price >= 0),
  amount_paid numeric(12,0) not null default 0 check (amount_paid >= 0),
  source text not null default 'directo'
    check (source in ('whatsapp', 'instagram', 'airbnb', 'directo', 'otro')),
  status text not null default 'confirmed'
    check (status in ('confirmed', 'pending', 'blocked')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (amount_paid <= total_price)
);

-- 2) Índices útiles
create index if not exists reservations_check_in_idx on public.reservations (check_in);
create index if not exists reservations_check_out_idx on public.reservations (check_out);
create index if not exists reservations_cabin_id_idx on public.reservations (cabin_id);
create index if not exists reservations_status_idx on public.reservations (status);

-- 3) updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
before update on public.reservations
for each row
execute function public.set_updated_at();

-- 4) RLS (acceso compartido para cualquiera con tu link + anon key)
alter table public.reservations enable row level security;

drop policy if exists reservations_select_all on public.reservations;
drop policy if exists reservations_insert_all on public.reservations;
drop policy if exists reservations_update_all on public.reservations;
drop policy if exists reservations_delete_all on public.reservations;

create policy reservations_select_all
on public.reservations
for select
to anon, authenticated
using (true);

create policy reservations_insert_all
on public.reservations
for insert
to anon, authenticated
with check (true);

create policy reservations_update_all
on public.reservations
for update
to anon, authenticated
using (true)
with check (true);

create policy reservations_delete_all
on public.reservations
for delete
to anon, authenticated
using (true);

-- 5) Realtime (para que todos vean cambios en vivo)
alter table public.reservations replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reservations'
  ) then
    alter publication supabase_realtime add table public.reservations;
  end if;
end $$;
