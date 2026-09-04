-- =============================================================================
-- 0001_inicial.sql — Estructura inicial de la base de datos
-- Proyecto: Prestamo (marketplace de renta de objetos)
--
-- CÓMO SE CORRE ESTO:
--   Panel de Supabase → SQL Editor → pegar todo → Run
--   (más adelante, cuando instalemos la CLI de Supabase, se corre solo)
--
-- REGLAS QUE ESTE ARCHIVO HACE CUMPLIR (ver CLAUDE.md):
--   1. El dinero se guarda en CENTAVOS ENTEROS. Q125.50 se guarda como 12550.
--   2. Las fechas de reserva son DATE (solo el día) y el rango es INCLUSIVO:
--      del 15 al 17 son 3 días. La base de datos calcula los días sola.
--   3. RLS (Row Level Security) queda ACTIVADO Y CERRADO en todas las tablas.
--      Sin políticas, nadie puede leer ni escribir nada desde el navegador.
--      Las puertas se abren una por una en las migraciones siguientes.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Extensiones
-- -----------------------------------------------------------------------------

-- pg_trgm permite que las búsquedas con ILIKE '%taladro%' sean rápidas.
-- Sin esto, buscar texto obliga a Postgres a leer todas las filas una por una.
create extension if not exists pg_trgm;


-- -----------------------------------------------------------------------------
-- Tipos cerrados (enums)
--
-- Un enum es una lista fija de valores permitidos. Si el código intenta guardar
-- "pagado_a_medias" en el estado de una reserva, la base de datos lo rechaza.
-- Es la red de seguridad de la máquina de estados descrita en PLAN.md sección 3.
-- -----------------------------------------------------------------------------

create type estado_reserva as enum (
  'solicitada',    -- el renter pidió las fechas, el publicador no ha contestado
  'aceptada',      -- el publicador dijo que sí; falta pagar
  'rechazada',     -- el publicador dijo que no (final)
  'pagada',        -- el dinero está en la cuenta de la plataforma
  'entregada',     -- el publicador entregó el objeto
  'devuelta',      -- el renter lo devolvió sin problema; toca liberar el pago
  'con_problema',  -- el renter reportó un problema; el pago queda congelado
  'cancelada'      -- cualquiera de los dos canceló antes de la entrega
);

create type estado_pago as enum (
  'retenido',    -- el dinero está en la cuenta de la plataforma
  'liberado',    -- ya se le transfirió al publicador (a mano)
  'reembolsado'  -- se le devolvió al renter (a mano)
);


-- -----------------------------------------------------------------------------
-- users — el perfil de cada persona
--
-- OJO: Supabase ya tiene su propia tabla auth.users con el correo y la
-- contraseña/sesión. Esta tabla es NUESTRA información adicional (nombre,
-- teléfono, ciudad, datos bancarios) y se enlaza con aquella por el id.
--
-- El "on delete cascade" significa: si se borra la cuenta en Supabase Auth,
-- este perfil se borra solo. Sin eso quedarían perfiles huérfanos.
-- -----------------------------------------------------------------------------

create table public.users (
  id                uuid primary key references auth.users (id) on delete cascade,
  correo            text        not null,
  nombre            text,
  telefono_whatsapp text,
  ciudad            text,
  foto_url          text,

  -- Bandera de administrador. Da acceso al panel de pagos (Fase 4).
  -- Se activa a mano desde el panel de Supabase, nunca desde la app.
  es_admin          boolean     not null default false,

  -- Datos para pagarle al publicador por transferencia bancaria.
  -- Se piden recién cuando alguien acepta su primera solicitud (Fase 4),
  -- no al registrarse. NUNCA aparecen en el perfil público.
  banco             text,
  tipo_cuenta       text,
  numero_cuenta     text,
  nombre_titular    text,

  creado_en         timestamptz not null default now()
);

comment on table public.users is
  'Perfil público y datos de pago. Se enlaza 1 a 1 con auth.users.';
comment on column public.users.es_admin is
  'Acceso al panel de administración. Se activa solo desde el panel de Supabase.';


-- -----------------------------------------------------------------------------
-- listings — cada cosa publicada para rentar
-- -----------------------------------------------------------------------------

create table public.listings (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid        not null references public.users (id) on delete cascade,

  titulo                 text        not null check (length(trim(titulo)) between 3 and 120),
  categoria              text        not null,
  descripcion            text        not null check (length(trim(descripcion)) between 10 and 2000),

  -- Dinero en centavos enteros. Mínimo Q1.00 (100 centavos), máximo Q50,000.00.
  -- El máximo existe para atrapar el error de escribir 150000 pensando en Q1,500.
  precio_por_dia_centavos integer    not null check (precio_por_dia_centavos between 100 and 5000000),

  ciudad                 text        not null,

  -- Cuántas unidades iguales tiene. Un particular con un taladro pone 1.
  -- Un negocio con 20 sillas pone 20. Esto es lo que vuelve difícil el
  -- cálculo de disponibilidad (ver PLAN.md sección 4).
  cantidad_disponible    integer     not null default 1 check (cantidad_disponible between 1 and 999),

  -- Falso = despublicado. No se borra nunca, porque puede tener reservas
  -- históricas colgando y borrarlo rompería el historial.
  activo                 boolean     not null default true,

  creado_en              timestamptz not null default now(),

  -- La lista de categorías vive en lib/categorias.ts. Esta restricción es el
  -- respaldo: impide que un error de código guarde basura. Agregar una
  -- categoría = una línea en el archivo TS + una migración de una línea.
  constraint listings_categoria_valida check (categoria in (
    'herramientas',
    'mobiliario_eventos',
    'equipo_audio_video',
    'deportes_aire_libre',
    'hogar_jardin',
    'otros'
  ))
);

create index listings_activo_creado_idx  on public.listings (activo, creado_en desc);
create index listings_ciudad_idx         on public.listings (ciudad)    where activo;
create index listings_categoria_idx      on public.listings (categoria) where activo;
create index listings_user_idx           on public.listings (user_id);

-- Índices para que la búsqueda por texto (ILIKE '%palabra%') sea rápida.
create index listings_titulo_trgm_idx      on public.listings using gin (titulo gin_trgm_ops);
create index listings_descripcion_trgm_idx on public.listings using gin (descripcion gin_trgm_ops);


-- -----------------------------------------------------------------------------
-- listing_photos — las fotos de cada publicación
--
-- La base de datos guarda solo el ENLACE a la foto. El archivo vive en
-- Supabase Storage. Guardar archivos dentro de la base la volvería lenta y cara.
-- -----------------------------------------------------------------------------

create table public.listing_photos (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid    not null references public.listings (id) on delete cascade,
  url        text    not null,
  orden      integer not null default 0,

  -- Dos fotos del mismo ítem no pueden ocupar la misma posición.
  -- "deferrable initially deferred" = la revisión se hace al final de la
  -- operación, no fila por fila. Así se pueden reordenar las fotos sin que
  -- choque un estado intermedio.
  unique (listing_id, orden) deferrable initially deferred
);

create index listing_photos_listing_idx on public.listing_photos (listing_id, orden);


-- -----------------------------------------------------------------------------
-- reservations — cada solicitud/reserva
--
-- Las tres columnas "generated always as" las calcula Postgres solo. El código
-- de la app no puede escribirlas, así que es IMPOSIBLE que queden mal.
-- Ahí es donde queda grabada la convención de días inclusivos.
-- -----------------------------------------------------------------------------

create table public.reservations (
  id        uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete restrict,
  renter_id  uuid not null references public.users (id)    on delete restrict,

  inicio_en date not null,
  fin_en    date not null,

  -- Días inclusivos: del 15 al 17 son 3 días. La resta de dos DATE en
  -- Postgres da un entero de días, por eso el +1.
  dias integer generated always as ((fin_en - inicio_en) + 1) stored,

  -- Copia CONGELADA del precio al momento de solicitar. Si el publicador
  -- sube su precio mañana, esta reserva no cambia de monto.
  precio_por_dia_centavos integer not null check (precio_por_dia_centavos > 0),

  -- El total lo calcula la base de datos: días × precio. No se puede desalinear.
  precio_total_centavos integer generated always as
    (((fin_en - inicio_en) + 1) * precio_por_dia_centavos) stored,

  -- Estos dos sí los escribe la app (el % de comisión es configurable).
  comision_plataforma_centavos integer not null check (comision_plataforma_centavos >= 0),
  monto_publicador_centavos    integer not null check (monto_publicador_centavos    >= 0),

  estado estado_reserva not null default 'solicitada',

  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- El rango tiene que tener sentido.
  constraint reservations_rango_valido check (fin_en >= inicio_en),

  -- Ninguna reserva puede durar más de 90 días (atrapa errores de dedo).
  constraint reservations_duracion_maxima check ((fin_en - inicio_en) <= 89),

  -- La plata tiene que cuadrar: comisión + lo del publicador = el total.
  -- Esto hace imposible el bug de contabilidad más caro que podríamos tener.
  constraint reservations_cuadra_el_dinero check (
    comision_plataforma_centavos + monto_publicador_centavos
      = ((fin_en - inicio_en) + 1) * precio_por_dia_centavos
  )
);

-- Índice pensado para la consulta de disponibilidad (PLAN.md sección 4):
-- "dame las reservas comprometidas de este listing que se traslapan con X e Y".
create index reservations_disponibilidad_idx
  on public.reservations (listing_id, inicio_en, fin_en)
  where estado in ('aceptada', 'pagada', 'entregada');

create index reservations_renter_idx on public.reservations (renter_id, creado_en desc);
create index reservations_estado_idx on public.reservations (estado);

comment on column public.reservations.dias is
  'Calculado por la base de datos. Rango INCLUSIVO: del 15 al 17 = 3 días.';
comment on column public.reservations.precio_por_dia_centavos is
  'Copia congelada del precio del listing al momento de solicitar.';


-- Mantener actualizado_en al día, sin que el código tenga que acordarse.
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger reservations_actualizado_en
  before update on public.reservations
  for each row execute function public.tocar_actualizado_en();


-- -----------------------------------------------------------------------------
-- payments — el registro del dinero
--
-- IMPORTANTE: esta tabla NO mueve dinero. Es la contabilidad de la plataforma.
-- El cobro lo hace Recurrente; el pago al publicador lo hacen ustedes a mano
-- por transferencia bancaria y lo marcan en el panel (PLAN.md sección 1).
-- -----------------------------------------------------------------------------

create table public.payments (
  id             uuid primary key default gen_random_uuid(),

  -- Una reserva tiene como máximo un pago.
  reservation_id uuid not null unique references public.reservations (id) on delete restrict,

  monto_centavos integer not null check (monto_centavos > 0),
  estado         estado_pago not null default 'retenido',

  -- El identificador que da Recurrente. Es lo que permite que recibir el mismo
  -- aviso (webhook) cinco veces no cree cinco pagos: se busca por aquí primero.
  procesador_id_externo text unique,

  -- Rastro de la transferencia manual al publicador.
  liberado_en             timestamptz,
  liberado_por            uuid references public.users (id),
  referencia_transferencia text,
  notas_admin             text,

  creado_en timestamptz not null default now(),

  -- Si está liberado, tiene que constar cuándo y quién. Sin excepciones:
  -- es lo que les permite responder "no me pagaron" en 10 segundos.
  constraint payments_liberado_tiene_rastro check (
    estado <> 'liberado'
    or (liberado_en is not null and liberado_por is not null)
  )
);

create index payments_estado_idx      on public.payments (estado, creado_en);
create index payments_reservation_idx on public.payments (reservation_id);


-- -----------------------------------------------------------------------------
-- reviews — calificaciones después de la renta
-- -----------------------------------------------------------------------------

create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  autor_id       uuid not null references public.users (id) on delete cascade,
  calificado_id  uuid not null references public.users (id) on delete cascade,

  estrellas  smallint not null check (estrellas between 1 and 5),
  comentario text     check (comentario is null or length(trim(comentario)) <= 1000),

  creado_en timestamptz not null default now(),

  -- Una sola calificación por persona por reserva. Sin esto, alguien enojado
  -- puede dejar 40 reseñas de una estrella sobre la misma renta.
  unique (reservation_id, autor_id),

  -- Nadie se califica a sí mismo.
  constraint reviews_no_autocalificarse check (autor_id <> calificado_id)
);

create index reviews_calificado_idx on public.reviews (calificado_id, creado_en desc);


-- -----------------------------------------------------------------------------
-- Crear el perfil automáticamente cuando alguien se registra
--
-- Supabase mete la fila en auth.users cuando alguien entra por primera vez con
-- su enlace mágico. Este disparador crea al mismo tiempo su fila en public.users.
-- Sin esto, tendríamos usuarios autenticados sin perfil y todo se rompería.
--
-- "security definer" = esta función corre con permisos elevados, saltándose
-- las reglas de RLS. Es necesario porque en ese instante todavía no hay sesión.
-- -----------------------------------------------------------------------------

create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, correo)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger al_crear_usuario_auth
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();


-- -----------------------------------------------------------------------------
-- RLS — Row Level Security
--
-- Supabase expone la base de datos directamente al navegador. SIN ESTO,
-- cualquier persona en internet podría leer todos los datos y borrarlos.
-- Es la falla de seguridad más común en proyectos con Supabase.
--
-- Activar RLS sin crear políticas = TODO CERRADO. Nada entra, nada sale.
-- Las puertas se abren una por una, con su justificación, en las migraciones
-- de cada fase (0002 en adelante).
-- -----------------------------------------------------------------------------

alter table public.users          enable row level security;
alter table public.listings       enable row level security;
alter table public.listing_photos enable row level security;
alter table public.reservations   enable row level security;
alter table public.payments       enable row level security;
alter table public.reviews        enable row level security;

-- Única puerta abierta en esta migración: cada quien puede ver y editar
-- su propio perfil. Sin esto no se puede ni completar el registro.
create policy "cada quien ve su propio perfil"
  on public.users for select
  using (auth.uid() = id);

create policy "cada quien edita su propio perfil"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- La política de update de arriba deja al usuario editar SU fila... incluida la
-- columna es_admin. Sin lo que sigue, cualquiera podría hacerse administrador
-- a sí mismo con una sola petición desde el navegador.
--
-- Este disparador congela las columnas sensibles cuando la petición viene del
-- navegador. "request.jwt.claims" solo existe cuando la petición llega por la
-- API de Supabase con la sesión de un usuario; desde el editor SQL del panel
-- (o sea, ustedes) está vacío y sí se puede cambiar.

create or replace function public.proteger_columnas_sensibles()
returns trigger
language plpgsql
as $$
begin
  if current_setting('request.jwt.claims', true) is not null then
    new.id       := old.id;
    new.correo   := old.correo;
    new.es_admin := old.es_admin;
  end if;
  return new;
end;
$$;

create trigger users_proteger_columnas_sensibles
  before update on public.users
  for each row execute function public.proteger_columnas_sensibles();
