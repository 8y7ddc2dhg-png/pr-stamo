-- =============================================================================
-- 0006_mensajes.sql — Chat entre quien renta y quien publica
--
-- CÓMO SE CORRE: SQL Editor → New query → pegar todo → clic en un espacio
-- vacío (que no quede texto seleccionado) → Run.
--
-- NOTA DE ALCANCE: el brief original dejaba el chat FUERA a propósito, porque
-- WhatsApp ya está instalado en todos los teléfonos de Guatemala y funciona
-- mejor que lo que podríamos construir. Se agrega para la demostración
-- académica, donde mostrar la conversación adentro de la app tiene valor.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- mensajes
--
-- Cada mensaje cuelga de una RESERVA, no de dos usuarios sueltos. Es una
-- decisión importante: así la conversación siempre tiene contexto —de qué
-- objeto y de qué fechas se está hablando— y los permisos salen solos, porque
-- las dos personas con derecho a hablar son exactamente las dos partes de esa
-- reserva. No hace falta una tabla de "conversaciones" ni de "participantes".
-- -----------------------------------------------------------------------------

create table public.mensajes (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  autor_id       uuid not null references public.users (id) on delete cascade,

  texto text not null check (length(trim(texto)) between 1 and 1000),

  creado_en timestamptz not null default now()
);

create index mensajes_reserva_idx on public.mensajes (reservation_id, creado_en);

comment on table public.mensajes is
  'Conversación de una reserva. Solo las dos partes pueden leerla y escribirla.';


-- -----------------------------------------------------------------------------
-- Permisos
--
-- La misma condición se repite en las dos políticas: hay que ser quien renta o
-- el dueño del ítem. Se escribe completa en cada una en vez de factorizarla,
-- porque una política de seguridad se lee mejor sola: quien la revise dentro
-- de un año no debería tener que ir a buscar otra función para entenderla.
-- -----------------------------------------------------------------------------

alter table public.mensajes enable row level security;

create policy "las dos partes leen la conversación de su reserva"
  on public.mensajes for select
  to authenticated
  using (
    exists (
      select 1
      from public.reservations r
      join public.listings l on l.id = r.listing_id
      where r.id = reservation_id
        and (r.renter_id = auth.uid() or l.user_id = auth.uid())
    )
  );

create policy "las dos partes escriben en su reserva"
  on public.mensajes for insert
  to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1
      from public.reservations r
      join public.listings l on l.id = r.listing_id
      where r.id = reservation_id
        and (r.renter_id = auth.uid() or l.user_id = auth.uid())
    )
  );

-- Sin UPDATE ni DELETE: un mensaje enviado no se edita ni se borra.
-- Si se pudiera, alguien podría cambiar lo que acordó después de un problema,
-- y la conversación dejaría de servir como respaldo de lo que se habló.


-- -----------------------------------------------------------------------------
-- Actualización en vivo
--
-- Esto le pide a Supabase que avise a los navegadores conectados cuando entra
-- un mensaje nuevo, para que aparezca sin recargar la página. Los permisos de
-- arriba siguen aplicando: a cada quien solo le llegan los mensajes que ya
-- tendría derecho a leer.
--
-- Si esta línea falla, no es grave: la pantalla también revisa cada 4 segundos
-- por su cuenta. El chat funciona igual, solo que un poco menos inmediato.
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.mensajes;
