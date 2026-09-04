/**
 * Prueba las reglas de seguridad (RLS) con usuarios REALES con sesión.
 *
 * CÓMO SE CORRE:   npm run probar:permisos
 *
 * Las pruebas anteriores usaban la llave de servicio, que se salta todas las
 * reglas, o la anónima, que no tiene sesión. Ninguna de las dos prueba el caso
 * que importa de verdad: dos usuarios con cuenta, y que ninguno pueda tocar
 * las cosas del otro.
 *
 * Crea dos usuarios, hace que cada uno intente meterse con lo del otro, y
 * comprueba que la base de datos los frene. Al final borra todo.
 */
import { createClient } from "@supabase/supabase-js";

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_SUPA, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const resultados = [];
const anotar = (n, ok, det) => resultados.push({ n, ok, det });
const creados = [];

async function crearUsuarioConSesion(etiqueta) {
  const correo = `permisos-${etiqueta}-${Date.now()}@ejemplo-prestamo.test`;
  const clave = `Clave-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email: correo, password: clave, email_confirm: true,
  });
  if (error) throw new Error(`No se pudo crear ${correo}: ${error.message}`);
  creados.push(data.user.id);

  const cliente = createClient(URL_SUPA, ANON, { auth: { persistSession: false } });
  const { error: errIngreso } = await cliente.auth.signInWithPassword({ email: correo, password: clave });
  if (errIngreso) throw new Error(`No se pudo ingresar como ${correo}: ${errIngreso.message}`);

  await admin.from("users").update({
    nombre: `Usuario ${etiqueta}`, telefono_whatsapp: "55110000", ciudad: "Mixco",
  }).eq("id", data.user.id);

  return { id: data.user.id, cliente };
}

try {
  const ana = await crearUsuarioConSesion("ana");
  const beto = await crearUsuarioConSesion("beto");

  // --- Ana publica lo suyo ---
  const { data: itemDeAna, error: errPublicar } = await ana.cliente.from("listings").insert({
    user_id: ana.id, titulo: "Escalera de aluminio 6 peldaños", categoria: "herramientas",
    descripcion: "Escalera de aluminio en buen estado, para trabajos de altura media.",
    precio_por_dia_centavos: 5000, ciudad: "Mixco", cantidad_disponible: 1,
  }).select("id").single();
  anotar("Ana puede publicar a su nombre", !errPublicar && !!itemDeAna, errPublicar?.message ?? "publicado");

  // --- Beto intenta publicar HACIÉNDOSE PASAR por Ana ---
  const { error: errSuplantar } = await beto.cliente.from("listings").insert({
    user_id: ana.id, titulo: "Publicación suplantada", categoria: "otros",
    descripcion: "Esto no debería poder guardarse jamás.",
    precio_por_dia_centavos: 1000, ciudad: "Mixco", cantidad_disponible: 1,
  });
  anotar("Beto NO puede publicar a nombre de Ana", !!errSuplantar,
    errSuplantar ? "rechazado por RLS" : "SE GUARDÓ (grave)");

  // --- Beto intenta editar el ítem de Ana ---
  const { data: edicion } = await beto.cliente.from("listings")
    .update({ precio_por_dia_centavos: 1 }).eq("id", itemDeAna.id).select("id");
  anotar("Beto NO puede editar el ítem de Ana", (edicion?.length ?? 0) === 0,
    `${edicion?.length ?? 0} filas modificadas`);

  // --- Beto intenta regalarse el ítem de Ana ---
  const { data: robo } = await beto.cliente.from("listings")
    .update({ user_id: beto.id }).eq("id", itemDeAna.id).select("id");
  anotar("Beto NO puede apropiarse del ítem de Ana", (robo?.length ?? 0) === 0,
    `${robo?.length ?? 0} filas modificadas`);

  // --- Ni siquiera Ana puede borrar: se despublica, no se borra ---
  const { data: borrado } = await ana.cliente.from("listings")
    .delete().eq("id", itemDeAna.id).select("id");
  anotar("Nadie puede BORRAR publicaciones (por diseño)", (borrado?.length ?? 0) === 0,
    `${borrado?.length ?? 0} filas borradas`);

  const { data: despublicado } = await ana.cliente.from("listings")
    .update({ activo: false }).eq("id", itemDeAna.id).select("activo");
  anotar("Ana sí puede despublicar lo suyo", despublicado?.[0]?.activo === false,
    `activo = ${despublicado?.[0]?.activo}`);

  // --- Un ítem despublicado desaparece del catálogo público ---
  const publico = createClient(URL_SUPA, ANON);
  const { data: enCatalogo } = await publico.from("listings").select("id").eq("id", itemDeAna.id);
  anotar("Lo despublicado no se ve en el catálogo", (enCatalogo?.length ?? 0) === 0,
    `${enCatalogo?.length ?? 0} visibles sin sesión`);

  const { data: loVeAna } = await ana.cliente.from("listings").select("id").eq("id", itemDeAna.id);
  anotar("Pero Ana sigue viendo lo suyo despublicado", (loVeAna?.length ?? 0) === 1,
    `${loVeAna?.length ?? 0} visibles para la dueña`);

  const { data: loVeBeto } = await beto.cliente.from("listings").select("id").eq("id", itemDeAna.id);
  anotar("Y Beto no lo ve", (loVeBeto?.length ?? 0) === 0, `${loVeBeto?.length ?? 0} visibles para Beto`);

  // --- Beto intenta leer el teléfono de Ana ---
  const { data: espia } = await beto.cliente.from("users")
    .select("telefono_whatsapp, correo").eq("id", ana.id);
  anotar("Beto NO puede ver el teléfono ni el correo de Ana", (espia?.length ?? 0) === 0,
    `${espia?.length ?? 0} filas`);

  // --- Beto intenta hacerse administrador ---
  await beto.cliente.from("users").update({ es_admin: true }).eq("id", beto.id);
  const { data: perfilBeto } = await admin.from("users").select("es_admin").eq("id", beto.id).single();
  anotar("Beto NO puede hacerse administrador", perfilBeto?.es_admin === false,
    `es_admin quedó en ${perfilBeto?.es_admin}`);

  // --- Beto intenta subir una foto a la carpeta de Ana ---
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const { error: errCarpetaAjena } = await beto.cliente.storage
    .from("fotos-items").upload(`${ana.id}/intruso.png`, bytes, { contentType: "image/png" });
  anotar("Beto NO puede subir a la carpeta de Ana", !!errCarpetaAjena,
    errCarpetaAjena ? "rechazado" : "SE SUBIÓ (grave)");

  const { error: errCarpetaPropia } = await beto.cliente.storage
    .from("fotos-items").upload(`${beto.id}/propia.png`, bytes, { contentType: "image/png" });
  anotar("Beto sí puede subir a su propia carpeta", !errCarpetaPropia,
    errCarpetaPropia?.message ?? "subida");
} finally {
  for (const id of creados) {
    const { data: archivos } = await admin.storage.from("fotos-items").list(id);
    if (archivos?.length) {
      await admin.storage.from("fotos-items").remove(archivos.map((a) => `${id}/${a.name}`));
    }
    await admin.auth.admin.deleteUser(id);
  }
  anotar("Se limpian los usuarios de prueba", true, `${creados.length} borrados`);
}

let fallos = 0;
console.log("");
for (const r of resultados) {
  if (!r.ok) fallos++;
  console.log(`  ${r.ok ? "OK  " : "FALLA"}  ${r.n.padEnd(50)} ${r.det}`);
}
console.log(`\n  ${resultados.length - fallos} de ${resultados.length} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
