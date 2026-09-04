/**
 * Verifica que la app pueda hablar con Supabase y que las reglas de seguridad
 * estén haciendo su trabajo.
 *
 * CÓMO SE CORRE:   npm run verificar
 *
 * Correlo cada vez que cambien las llaves de .env.local, después de aplicar
 * una migración nueva, y antes de dar por buena una publicación a Vercel.
 *
 * Las pruebas que dicen "RLS impide..." son las importantes: comprueban que
 * un visitante SIN cuenta no pueda leer datos privados ni escribir nada.
 * Si alguna de esas falla, hay un hueco de seguridad abierto.
 */
import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const publico = createClient(url, anon);
const admin   = createClient(url, svc, { auth: { persistSession: false } });

const resultados = [];
const anotar = (n, ok, det) => resultados.push({ n, ok, det });

// --- Como visitante sin cuenta (llave anónima) ---
{
  const { error } = await publico.from("listings").select("id").limit(1);
  anotar("Visitante lee el catálogo", !error, error?.message ?? "sin error");
}
{
  const { data, error } = await publico.from("users").select("correo").limit(1);
  anotar("RLS oculta la tabla users al visitante",
    !error && (data?.length ?? 0) === 0,
    error ? `bloqueado: ${error.message}` : `${data.length} filas devueltas`);
}
{
  const { error } = await publico.from("perfiles_publicos").select("nombre").limit(1);
  anotar("Vista perfiles_publicos es legible", !error, error?.message ?? "sin error");
}
{
  const { error } = await publico.from("listings").insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    titulo: "intento no autorizado", categoria: "otros",
    descripcion: "esto no deberia guardarse nunca",
    precio_por_dia_centavos: 10000, ciudad: "Ciudad de Guatemala",
  });
  anotar("RLS impide publicar sin sesión", !!error, error ? "rechazado correctamente" : "SE GUARDÓ (grave)");
}
{
  const { data, error } = await publico.from("payments").select("id").limit(1);
  anotar("RLS oculta la tabla payments",
    !error ? (data?.length ?? 0) === 0 : true,
    error ? "bloqueado" : `${data.length} filas devueltas`);
}

// --- Como servidor (llave de servicio) ---
for (const t of ["users","listings","listing_photos","reservations","payments","reviews"]) {
  const { count, error } = await admin.from(t).select("*", { count: "exact", head: true });
  anotar(`Tabla ${t} accesible desde el servidor`, !error, error?.message ?? `${count} filas`);
}
{
  const { data, error } = await admin.storage.listBuckets();
  const b = data?.find((x) => x.id === "fotos-items");
  anotar("Bucket fotos-items existe y es público",
    !error && !!b && b.public === true,
    error?.message ?? (b ? `público=${b.public}, límite=${(b.file_size_limit/1048576).toFixed(0)} MB` : "no encontrado"));
}

let fallos = 0;
console.log("");
for (const r of resultados) {
  if (!r.ok) fallos++;
  console.log(`  ${r.ok ? "OK  " : "FALLA"}  ${r.n.padEnd(46)} ${r.det}`);
}
console.log(`\n  ${resultados.length - fallos} de ${resultados.length} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
