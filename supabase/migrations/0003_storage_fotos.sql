-- =============================================================================
-- 0003_storage_fotos.sql — Dónde viven las fotos de los ítems
-- Fase 1
--
-- CÓMO SE CORRE: igual que las anteriores, en el SQL Editor.
--
-- Va aparte de la 0002 a propósito: los permisos de Storage a veces fallan
-- desde el editor SQL según cómo esté configurado el proyecto. Si esta falla,
-- la 0002 ya quedó aplicada y no hay que rehacer nada. Al final del archivo
-- está el plan B, con clics en el panel.
--
-- QUÉ ES STORAGE: es donde Supabase guarda archivos (fotos, PDFs). La base de
-- datos guarda solo el enlace al archivo; el archivo vive acá. Meter fotos
-- dentro de la base de datos la volvería lentísima y cara.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- El "bucket" (cubeta): la carpeta grande donde van todas las fotos de ítems.
--
--   public = true    → cualquiera con el enlace puede ver la foto, sin permisos.
--                      Es lo correcto acá: el catálogo es público, y si las
--                      fotos exigieran permiso, tardarían más en cargar y no se
--                      podrían mostrar en resultados de Google.
--
--   5 MB por archivo → después de achicar la foto en el navegador, una foto de
--                      celular pesa menos de 1 MB. El límite es la red de
--                      seguridad por si el achicado falla.
--
--   solo imágenes    → impide que alguien suba un programa disfrazado de foto.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-items',
  'fotos-items',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
-- Permisos sobre los archivos
--
-- Cada usuario sube a una carpeta con su propio id:
--     fotos-items/a1b2c3.../taladro-1.jpg
--                 ↑ el id del usuario
--
-- `storage.foldername(name)` parte esa ruta en pedazos, y `[1]` toma el
-- primero. Comparándolo con el id de quien está subiendo, se garantiza que
-- nadie pueda escribir ni borrar dentro de la carpeta de otro.
-- -----------------------------------------------------------------------------

create policy "cualquiera ve las fotos de los ítems"
  on storage.objects for select
  using (bucket_id = 'fotos-items');

create policy "cada quien sube a su propia carpeta"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-items'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "cada quien borra solo sus propias fotos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fotos-items'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- =============================================================================
-- PLAN B — si esta migración da un error de permisos
--
-- Si al correrla sale algo como "must be owner of table objects", significa que
-- este proyecto no deja crear permisos de Storage desde SQL. No es grave.
-- Se hace con clics:
--
--   1. Storage → New bucket
--        Name: fotos-items
--        Public bucket: SÍ (activado)
--        File size limit: 5 MB
--        Allowed MIME types: image/jpeg, image/png, image/webp
--
--   2. Storage → Policies → New policy sobre el bucket fotos-items,
--      tres políticas, usando la plantilla que corresponda:
--        - SELECT  para "anon, authenticated"  (ver fotos)
--        - INSERT  para "authenticated"        (subir a su carpeta)
--        - DELETE  para "authenticated"        (borrar sus fotos)
--      En las dos últimas, la condición es:
--        (storage.foldername(name))[1] = auth.uid()::text
--
-- Avisame cuál de los dos caminos usaste, para dejarlo anotado.
-- =============================================================================
