-- =============================================================================
-- 0005_categorias_ropa_electronicos.sql — Dos categorías nuevas
--
-- POR QUÉ HACE FALTA UNA MIGRACIÓN PARA ESTO:
-- la lista de categorías vive en dos lugares a propósito. En lib/categorias.ts,
-- que es la que llena el menú de la pantalla, y en esta restricción, que es la
-- que impide que un error de código guarde una categoría inventada.
--
-- Agregar una categoría es entonces: una línea en el archivo TypeScript y esta
-- migración. Si se hace solo lo primero, la base de datos rechaza la
-- publicación con un error que no dice nada útil.
-- =============================================================================

alter table public.listings
  drop constraint if exists listings_categoria_valida;

alter table public.listings
  add constraint listings_categoria_valida check (categoria in (
    'herramientas',
    'mobiliario_eventos',
    'equipo_audio_video',
    'deportes_aire_libre',
    'hogar_jardin',
    'ropa',           -- nueva
    'electronicos',   -- nueva
    'otros'
  ));
