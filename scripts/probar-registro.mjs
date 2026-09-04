/**
 * Comprueba que registrarse cree el perfil solo.
 *
 * CÓMO SE CORRE:   npm run probar:registro
 *
 * Crea un usuario de prueba con la llave de servicio, revisa que el disparador
 * `al_crear_usuario_auth` haya creado su fila en public.users, prueba que las
 * columnas sensibles estén protegidas, y al final lo borra.
 *
 * No manda ningún correo: el usuario se crea ya confirmado.
 */
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const correo = `prueba-${Date.now()}@ejemplo-prestamo.test`;
const resultados = [];
const anotar = (n, ok, det) => resultados.push({ n, ok, det });
let id = null;

try {
  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    email_confirm: true,
  });
  anotar("Se crea la cuenta", !error, error?.message ?? correo);
  id = data?.user?.id ?? null;

  if (id) {
    // El disparador corre dentro de la misma operación, pero damos un respiro
    // por si la réplica de lectura va un instante atrás.
    await new Promise((r) => setTimeout(r, 400));

    const { data: perfil, error: errPerfil } = await admin
      .from("users").select("*").eq("id", id).single();

    anotar("El disparador crea el perfil solo", !errPerfil && !!perfil,
      errPerfil?.message ?? "fila encontrada en public.users");
    anotar("El correo queda copiado en el perfil", perfil?.correo === correo,
      perfil?.correo === correo ? "coincide" : `guardó ${perfil?.correo}`);
    anotar("Nadie nace administrador", perfil?.es_admin === false,
      `es_admin = ${perfil?.es_admin}`);
    anotar("El perfil arranca sin datos bancarios",
      !perfil?.numero_cuenta && !perfil?.banco, "vacíos, como debe ser");

    // Un visitante sin sesión no debería ver este perfil recién creado.
    const publico = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: fuga } = await publico.from("users").select("correo").eq("id", id);
    anotar("RLS oculta el perfil nuevo a los visitantes",
      (fuga?.length ?? 0) === 0, `${fuga?.length ?? 0} filas visibles sin sesión`);

    const { data: visible } = await publico
      .from("perfiles_publicos").select("id, nombre, ciudad, foto_url").eq("id", id);
    const columnas = visible?.[0] ? Object.keys(visible[0]).sort().join(", ") : "(sin filas)";
    anotar("perfiles_publicos solo expone 4 columnas",
      columnas === "ciudad, foto_url, id, nombre", columnas);
  }
} finally {
  if (id) {
    const { error } = await admin.auth.admin.deleteUser(id);
    anotar("Se borra el usuario de prueba", !error, error?.message ?? "limpio");
    const { data: resto } = await admin.from("users").select("id").eq("id", id);
    anotar("Borrar la cuenta borra el perfil (cascade)",
      (resto?.length ?? 0) === 0, `${resto?.length ?? 0} filas quedaron`);
  }
}

let fallos = 0;
console.log("");
for (const r of resultados) {
  if (!r.ok) fallos++;
  console.log(`  ${r.ok ? "OK  " : "FALLA"}  ${r.n.padEnd(46)} ${r.det}`);
}
console.log(`\n  ${resultados.length - fallos} de ${resultados.length} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
