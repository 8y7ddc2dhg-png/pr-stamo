-- =============================================================================
-- 0007_contactos_de_reserva.sql — El teléfono de la otra parte
--
-- CÓMO SE CORRE: SQL Editor → New query → pegar todo → clic en un espacio
-- vacío → Run.
--
-- EL PROBLEMA QUE RESUELVE:
-- la pantalla de la reserva quiere mostrar el WhatsApp de la otra persona para
-- coordinar la entrega. Pero la tabla `users` solo se puede leer a uno mismo
-- —y está bien que así sea, porque ahí también viven el correo y los datos
-- bancarios—. Resultado: el teléfono nunca llegaba y la línea desaparecía sin
-- avisar.
--
-- LA SOLUCIÓN: una ventana angosta, igual que `perfiles_publicos`, pero más
-- estricta todavía. Expone SOLO nombre y teléfono, SOLO a las dos partes de
-- esa reserva, y SOLO cuando la reserva ya fue aceptada.
--
-- Por qué recién al aceptar: si el teléfono se viera antes, la plataforma
-- sería un directorio de contactos y cualquiera podría sacar números sin
-- comprometerse a nada.
-- =============================================================================

create view public.contactos_de_reserva
with (security_invoker = false) as
  select
    r.id              as reservation_id,
    u.id              as usuario_id,
    u.nombre,
    u.telefono_whatsapp
  from public.reservations r
  join public.listings l on l.id = r.listing_id
  join public.users    u on u.id in (r.renter_id, l.user_id)
  where
    -- Solo las dos partes de esta reserva. Aunque la vista se salte las reglas
    -- de `users`, esta condición la vuelve a cerrar: alguien ajeno no aparece
    -- en ningún lado de este join.
    auth.uid() in (r.renter_id, l.user_id)
    -- Y solo cuando ya hay un compromiso real de por medio.
    and r.estado in ('aceptada', 'pagada', 'entregada', 'devuelta', 'con_problema');

comment on view public.contactos_de_reserva is
  'Nombre y WhatsApp de las partes de una reserva aceptada. NUNCA agregar acá correo ni datos bancarios.';

-- A "authenticated" y no a "anon": sin sesión no hay reserva de la cual ser parte.
grant select on public.contactos_de_reserva to authenticated;
