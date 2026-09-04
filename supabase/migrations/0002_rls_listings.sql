-- =============================================================================
-- 0002_rls_listings.sql — Quién puede ver y tocar las publicaciones
-- Fase 1
--
-- CÓMO SE CORRE: panel de Supabase → SQL Editor → New query → pegar todo →
-- clic en un espacio vacío (que NO quede texto seleccionado) → Run.
--
-- La migración 0001 dejó todo cerrado. Acá se abren las puertas de las
-- publicaciones y sus fotos, una por una y con su razón escrita.
--
-- CÓMO FUNCIONAN LAS POLÍTICAS: cada una es un permiso. Si hay varias para la
-- misma acción, alcanza con que UNA deje pasar. Si no hay ninguna para una
-- acción, esa acción está prohibida para todos. Por eso más abajo no hay
-- ninguna política de DELETE sobre listings: borrar está prohibido, a propósito.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- perfiles_publicos — la cara visible de un usuario
--
-- EL PROBLEMA: la ficha de un ítem tiene que mostrar quién lo publica (nombre,
-- foto, ciudad). Pero la tabla `users` también guarda el correo, el teléfono y
-- los datos bancarios. Si abriéramos `users` a lectura pública para mostrar un
-- nombre, estaríamos publicando los números de cuenta de todos.
--
-- LA SOLUCIÓN: esta vista es una ventana angosta a la tabla. Solo deja ver
-- cuatro columnas. Las demás no existen para quien mira por acá.
--
-- "security_invoker = false" hace que la vista consulte con los permisos de su
-- dueño y no los de quien pregunta. Es lo que le permite saltarse la regla de
-- `users` ("cada quien ve solo su fila") y mostrar el nombre de cualquiera.
-- Es deliberado: el filtro de seguridad ya lo hace la propia lista de columnas.
-- El revisor automático de Supabase va a marcar esta vista con una advertencia;
-- es esperado y está bien.
-- -----------------------------------------------------------------------------

create view public.perfiles_publicos
with (security_invoker = false) as
  select id, nombre, ciudad, foto_url
  from public.users;

comment on view public.perfiles_publicos is
  'Solo nombre, ciudad y foto. NUNCA agregar acá correo, teléfono ni datos bancarios.';

grant select on public.perfiles_publicos to anon, authenticated;


-- -----------------------------------------------------------------------------
-- listings — las publicaciones
-- -----------------------------------------------------------------------------

-- LECTURA 1: el catálogo es público. Alguien que nunca se registró tiene que
-- poder buscar y ver qué hay; ese es el recorrido B del PLAN.md. Si obligáramos
-- a crear cuenta antes de mirar, casi nadie llegaría a publicar ni a rentar.
create policy "cualquiera ve las publicaciones activas"
  on public.listings for select
  using (activo);

-- LECTURA 2: el dueño ve las suyas aunque las haya despublicado. Sin esto,
-- despublicar un ítem sería lo mismo que perderlo.
create policy "el dueño ve sus propias publicaciones"
  on public.listings for select
  to authenticated
  using (auth.uid() = user_id);

-- ESCRITURA: se puede publicar, pero solo a nombre propio.
-- El `with check` es lo que impide que alguien cree una publicación poniendo
-- el user_id de otra persona.
create policy "el usuario publica solo a su nombre"
  on public.listings for insert
  to authenticated
  with check (auth.uid() = user_id);

-- EDICIÓN: solo el dueño, y no puede cambiarle el dueño a otro.
-- El `using` decide qué filas puede tocar; el `with check` decide cómo pueden
-- quedar después. Hacen falta los dos: sin el segundo, alguien podría editar
-- su propia publicación y de paso regalársela a otro usuario.
create policy "el dueño edita su publicación"
  on public.listings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- BORRADO: no hay política, o sea que nadie puede borrar publicaciones.
-- Es a propósito. Una publicación puede tener reservas históricas colgando y
-- borrarla rompería el historial y la contabilidad. Para sacarla del catálogo
-- se pone `activo = false`, que es lo que hace el botón "Despublicar".


-- -----------------------------------------------------------------------------
-- listing_photos — las fotos
--
-- Las fotos heredan la visibilidad de su publicación: si se puede ver el ítem,
-- se pueden ver sus fotos. Eso se expresa preguntando por la publicación padre.
-- La consulta de adentro también respeta las reglas de arriba, así que las dos
-- capas coinciden solas y no hay riesgo de que se desalineen.
-- -----------------------------------------------------------------------------

create policy "las fotos se ven si la publicación se ve"
  on public.listing_photos for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.activo or l.user_id = auth.uid())
    )
  );

create policy "el dueño agrega fotos a su publicación"
  on public.listing_photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id = auth.uid()
    )
  );

create policy "el dueño reordena las fotos de su publicación"
  on public.listing_photos for update
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id = auth.uid()
    )
  );

-- Acá SÍ se permite borrar: al editar una publicación se reemplazan las fotos,
-- y una foto suelta no tiene historial que proteger. El archivo en sí se borra
-- aparte, en Supabase Storage.
create policy "el dueño borra fotos de su publicación"
  on public.listing_photos for delete
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id = auth.uid()
    )
  );
