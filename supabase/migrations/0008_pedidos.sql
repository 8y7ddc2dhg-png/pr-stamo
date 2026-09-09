-- =============================================================================
-- 0008_pedidos.sql — Carrito, pedidos y confirmación atómica
--
-- CÓMO SE CORRE: SQL Editor → New query → pegar todo → clic en un espacio
-- vacío (que no quede texto seleccionado) → Run.
--
-- QUÉ ES UN PEDIDO Y POR QUÉ HACE FALTA:
-- una `reservation` es UN objeto en UNAS fechas. Pero el carrito puede llevar
-- tres cosas de la misma persona, y quien las alquila quiere verlas juntas:
-- una sola entrega, una sola dirección, un solo cobro. Eso es un pedido.
--
-- Un pedido agrupa reservas de UN MISMO dueño. Si el carrito tiene cosas de
-- tres personas distintas, salen tres pedidos: no hay forma de que una sola
-- entrega junte objetos que están en tres casas diferentes.
-- =============================================================================


-- TODO ESTE ARCHIVO ES UNA SOLA OPERACIÓN.
--
-- "begin" y "commit" hacen que Postgres aplique las 259 líneas completas o
-- ninguna. Si algo falla en la mitad, la base queda exactamente como estaba.
-- Sin esto, el editor de Supabase ejecuta sentencia por sentencia y un error
-- a la mitad dejaría, por ejemplo, la tabla creada pero sin la función que la
-- llena, que es peor que no haber empezado.
begin;


create type tipo_entrega as enum ('recoger', 'domicilio');


create table public.pedidos (
  id            uuid primary key default gen_random_uuid(),
  renter_id     uuid not null references public.users (id) on delete restrict,
  publicador_id uuid not null references public.users (id) on delete restrict,

  -- Copia congelada de los datos de contacto al momento de pedir. Si la
  -- persona después cambia su teléfono en el perfil, este pedido conserva el
  -- que se usó para coordinar esta entrega.
  nombre   text not null check (length(trim(nombre))   between 1 and 80),
  apellido text not null check (length(trim(apellido)) between 1 and 80),
  correo   text not null check (length(trim(correo))   between 3 and 200),
  telefono text not null check (telefono ~ '^[2-7][0-9]{7}$'),

  tipo_entrega tipo_entrega not null,
  direccion    text,
  zona         text,

  total_centavos integer not null default 0 check (total_centavos >= 0),

  creado_en timestamptz not null default now(),

  -- Si va a domicilio, tiene que haber a dónde llevarlo. La base lo exige para
  -- que no dependa de que la pantalla se acuerde de pedirlo.
  constraint pedidos_domicilio_tiene_direccion check (
    tipo_entrega <> 'domicilio'
    or (direccion is not null and length(trim(direccion)) > 0)
  ),

  -- Nadie se hace un pedido a sí mismo.
  constraint pedidos_no_a_si_mismo check (renter_id <> publicador_id)
);

create index pedidos_renter_idx     on public.pedidos (renter_id, creado_en desc);
create index pedidos_publicador_idx on public.pedidos (publicador_id, creado_en desc);

comment on table public.pedidos is
  'Agrupa las reservas de un mismo dueño hechas en una sola compra del carrito.';


-- Las reservas hechas desde el carrito apuntan a su pedido. Las hechas por
-- reserva directa —el flujo que ya existía y sigue funcionando— lo dejan nulo.
alter table public.reservations
  add column if not exists pedido_id uuid references public.pedidos (id) on delete restrict;

create index reservations_pedido_idx on public.reservations (pedido_id);


-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------

alter table public.pedidos enable row level security;

create policy "quien pide ve sus pedidos"
  on public.pedidos for select
  to authenticated
  using (auth.uid() = renter_id);

create policy "el dueño ve los pedidos de sus cosas"
  on public.pedidos for select
  to authenticated
  using (auth.uid() = publicador_id);

-- Sin INSERT, UPDATE ni DELETE directos: los pedidos se crean ÚNICAMENTE por
-- la función de abajo. Así es imposible armar un pedido salteándose la
-- verificación de disponibilidad.


-- -----------------------------------------------------------------------------
-- crear_pedidos_del_carrito — confirmar la compra
--
-- TODO OCURRE DENTRO DE UNA SOLA TRANSACCIÓN. Si cualquier línea del carrito
-- ya no está disponible, la función levanta un error y la base de datos
-- deshace TODO lo que llevaba hecho. No quedan pedidos a medias ni reservas
-- sueltas. Es la única forma de cumplir "si alguna no está libre, no crees
-- nada" sin cruzar los dedos.
--
-- POR QUÉ VA ACÁ Y NO EN EL CÓDIGO DE LA APP: entre revisar la disponibilidad
-- y guardar la reserva pasan milisegundos, y en ese hueco otra persona puede
-- reservar lo mismo. Acá el `for update` pone un candado sobre el ítem: quien
-- llegue segundo espera, y cuando le toca ya ve la realidad actualizada.
--
-- "security definer" = corre con permisos elevados. Es necesario para poder
-- crear filas en `pedidos`, que no acepta escrituras directas de nadie. La
-- primera línea del cuerpo verifica que haya sesión, así que no se puede usar
-- de forma anónima.
-- -----------------------------------------------------------------------------

create or replace function public.crear_pedidos_del_carrito(
  p_lineas       jsonb,          -- [{ "listing_id": uuid, "inicio_en": date, "fin_en": date }]
  p_nombre       text,
  p_apellido     text,
  p_correo       text,
  p_telefono     text,
  p_tipo_entrega tipo_entrega,
  p_direccion    text,
  p_zona         text,
  p_comision     numeric,        -- 0.15 = 15%
  p_metodo_pago  text            -- 'efectivo', 'en_linea' o null si no se paga ahora
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_linea     jsonb;
  v_listing   public.listings%rowtype;
  v_inicio    date;
  v_fin       date;
  v_dias      integer;
  v_total     integer;
  v_comision  integer;
  v_ocupacion integer;
  v_pedido_id uuid;
  v_reserva   public.reservations%rowtype;
  v_hoy       date := (now() at time zone 'America/Guatemala')::date;
  v_ids       uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'Necesitás ingresar para confirmar el pedido.';
  end if;

  if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Tu carrito está vacío.';
  end if;

  if p_comision is null or p_comision < 0 or p_comision > 1 then
    raise exception 'El porcentaje de comisión no es válido.';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas)
  loop
    -- El candado: nadie más puede tocar este ítem hasta que terminemos.
    select * into v_listing
    from public.listings
    where id = (v_linea->>'listing_id')::uuid
    for update;

    if not found or not v_listing.activo then
      raise exception 'Uno de los ítems de tu carrito ya no está disponible.';
    end if;

    if v_listing.user_id = v_uid then
      raise exception 'No podés rentar tus propios ítems: %', v_listing.titulo;
    end if;

    v_inicio := (v_linea->>'inicio_en')::date;
    v_fin    := (v_linea->>'fin_en')::date;

    if v_fin < v_inicio then
      raise exception 'Las fechas de "%" están al revés.', v_listing.titulo;
    end if;

    if v_inicio < v_hoy then
      raise exception 'Las fechas de "%" ya pasaron.', v_listing.titulo;
    end if;

    if (v_fin - v_inicio) > 89 then
      raise exception 'La renta de "%" no puede durar más de 90 días.', v_listing.titulo;
    end if;

    -- El día más ocupado del rango pedido. Se cuenta DÍA POR DÍA y no por
    -- traslapes: tres reservas pueden tocar el rango sin encimarse entre sí,
    -- y en ese caso ningún día concreto llega a tres.
    --
    -- Esta consulta también ve las reservas creadas más arriba en esta misma
    -- transacción, así que dos líneas del mismo carrito sobre el mismo objeto
    -- y las mismas fechas se detectan correctamente.
    select coalesce(max(t.cuantas), 0) into v_ocupacion
    from (
      select d.dia, count(*) as cuantas
      from generate_series(v_inicio, v_fin, interval '1 day') as d(dia)
      join public.reservations r
        on r.listing_id = v_listing.id
       and r.estado in ('solicitada', 'aceptada', 'pagada', 'entregada')
       and r.inicio_en <= d.dia::date
       and r.fin_en    >= d.dia::date
      group by d.dia
    ) t;

    if v_ocupacion >= v_listing.cantidad_disponible then
      raise exception 'Ya no hay cupo para "%" en esas fechas.', v_listing.titulo;
    end if;

    v_dias     := (v_fin - v_inicio) + 1;
    v_total    := v_listing.precio_por_dia_centavos * v_dias;
    v_comision := round(v_total * p_comision);

    -- Un pedido por dueño: si ya existe uno para esta persona en esta compra,
    -- se reutiliza.
    select id into v_pedido_id
    from public.pedidos
    where id = any(v_ids) and publicador_id = v_listing.user_id;

    if v_pedido_id is null then
      insert into public.pedidos (
        renter_id, publicador_id, nombre, apellido, correo, telefono,
        tipo_entrega, direccion, zona
      ) values (
        v_uid, v_listing.user_id, trim(p_nombre), trim(p_apellido), trim(p_correo),
        p_telefono, p_tipo_entrega, nullif(trim(coalesce(p_direccion, '')), ''),
        nullif(trim(coalesce(p_zona, '')), '')
      )
      returning id into v_pedido_id;

      v_ids := v_ids || v_pedido_id;
    end if;

    insert into public.reservations (
      listing_id, renter_id, inicio_en, fin_en, precio_por_dia_centavos,
      comision_plataforma_centavos, monto_publicador_centavos, estado, pedido_id
    ) values (
      v_listing.id, v_uid, v_inicio, v_fin, v_listing.precio_por_dia_centavos,
      v_comision, v_total - v_comision,
      case when p_metodo_pago is null then 'aceptada'::estado_reserva
           else 'pagada'::estado_reserva end,
      v_pedido_id
    )
    returning * into v_reserva;

    if p_metodo_pago is not null then
      insert into public.payments (reservation_id, monto_centavos, estado, metodo_simulado, notas_admin)
      values (v_reserva.id, v_total, 'retenido', p_metodo_pago,
              'PAGO SIMULADO — demo académica, no hubo cobro real.');
    end if;

    update public.pedidos
    set total_centavos = total_centavos + v_total
    where id = v_pedido_id;
  end loop;

  return to_jsonb(v_ids);
end;
$$;

revoke all on function public.crear_pedidos_del_carrito from public, anon;
grant execute on function public.crear_pedidos_del_carrito to authenticated;

commit;
