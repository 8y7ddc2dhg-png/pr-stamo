-- =============================================================================
-- 0004_reservas.sql — Permisos de reservas y pagos
-- Demo académica (7 de septiembre de 2026)
--
-- CÓMO SE CORRE: SQL Editor → New query → pegar todo → clic en un espacio
-- vacío (que no quede texto seleccionado) → Run.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- reservations
--
-- Hay dos personas con derecho a ver una reserva: quien renta y quien publicó
-- el ítem. Nadie más, ni siquiera para mirar.
-- -----------------------------------------------------------------------------

create policy "quien renta ve sus reservas"
  on public.reservations for select
  to authenticated
  using (auth.uid() = renter_id);

create policy "el dueño del ítem ve las reservas de su ítem"
  on public.reservations for select
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id = auth.uid()
    )
  );

-- Reservar a nombre propio, y nunca sobre el ítem de uno mismo: rentarse algo
-- a sí mismo no significa nada y ensuciaría el calendario de disponibilidad.
create policy "se reserva a nombre propio y sobre ítems ajenos"
  on public.reservations for insert
  to authenticated
  with check (
    auth.uid() = renter_id
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.activo and l.user_id <> auth.uid()
    )
  );

-- Los cambios de estado (pagar, cancelar) los hace quien renta sobre lo suyo.
-- QUÉ NO PROTEGE ESTA REGLA: no impide saltar pasos —marcar "pagada" una
-- reserva recién creada, por ejemplo—. Eso lo verifica el código del servidor
-- en /api/reservas/[id]/*. Para la demo alcanza; para producción, la
-- transición de estados tendría que vivir en una función de base de datos.
create policy "quien renta actualiza su reserva"
  on public.reservations for update
  to authenticated
  using (auth.uid() = renter_id)
  with check (auth.uid() = renter_id);

-- Sin política de DELETE: las reservas no se borran nunca. Se cancelan.
-- Una reserva borrada es plata que no se puede rastrear.


-- -----------------------------------------------------------------------------
-- payments
-- -----------------------------------------------------------------------------

create policy "las dos partes ven el pago de su reserva"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      join public.listings l on l.id = r.listing_id
      where r.id = reservation_id
        and (r.renter_id = auth.uid() or l.user_id = auth.uid())
    )
  );

create policy "quien renta registra el pago de su reserva"
  on public.payments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_id and r.renter_id = auth.uid()
    )
  );

-- Sin UPDATE ni DELETE sobre payments: un registro de pago no se edita ni se
-- borra. Si algo sale mal, se agrega otra fila que lo corrija. Es la misma
-- razón por la que en contabilidad no se borra un asiento: se contra-asienta.


-- -----------------------------------------------------------------------------
-- Método de pago (solo para la demo)
--
-- Guarda si el pago fue "en línea" o "en efectivo". En el diseño real esto lo
-- diría el procesador; acá lo elige el usuario en una pantalla, así que la
-- columna se llama como lo que es.
-- -----------------------------------------------------------------------------

alter table public.payments
  add column if not exists metodo_simulado text
    check (metodo_simulado is null or metodo_simulado in ('en_linea', 'efectivo'));

comment on column public.payments.metodo_simulado is
  'SOLO DEMO. No hay cobro real detrás. Se elimina cuando entre Recurrente.';
