-- Permite reservas para "Ambas Cabañas" (cabin_id = 'AB').
-- La app envía 'A' (Cabaña Blanca), 'B' (Cabaña De Madera) o 'AB' (Ambas Cabañas).
-- Error original: new row for relation "reservations" violates check constraint "reservations_cabin_id_check"

ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_cabin_id_check;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_cabin_id_check
  CHECK (cabin_id IN ('A', 'B', 'AB'));
