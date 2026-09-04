/**
 * Pruebas del chat, con tres usuarios reales con sesión.
 * CÓMO SE CORRE:  npm run probar:chat
 *
 * Lo que importa: que las dos partes de una reserva puedan conversar, y que
 * NADIE más pueda leer ni meterse en esa conversación.
 */
import { createClient } from "@supabase/supabase-js";
import { borrarUsuariosDemo } from "./limpiar-demo.mjs";

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_SUPA, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const res = [];
const anotar = (n, ok, d) => res.push({ n, ok, d });

async function usuario(e) {
  const correo = `chat-${e}-${Date.now()}@ejemplo-prestamo.test`;
  const clave = `C-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email: correo, password: clave, email_confirm: true });
  if (error) throw error;
  await admin.from("users").update({ nombre: `U ${e}`, telefono_whatsapp: "55110000", ciudad: "Mixco" }).eq("id", data.user.id);
  const c = createClient(URL_SUPA, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.signInWithPassword({ email: correo, password: clave });
  if (e2) throw e2;
  return { id: data.user.id, cliente: c };
}

try {
  const ana = await usuario("ana");    // publica
  const beto = await usuario("beto");  // renta
  const caro = await usuario("caro");  // ajena a todo

  const { data: item } = await ana.cliente.from("listings").insert({
    user_id: ana.id, titulo: "Generador eléctrico portátil", categoria: "herramientas",
    descripcion: "Generador de 3500 watts a gasolina, con arranque manual.",
    precio_por_dia_centavos: 25000, ciudad: "Mixco", cantidad_disponible: 1,
  }).select("id").single();

  const { data: reserva } = await beto.cliente.from("reservations").insert({
    listing_id: item.id, renter_id: beto.id,
    inicio_en: "2027-03-10", fin_en: "2027-03-12",
    precio_por_dia_centavos: 25000,
    comision_plataforma_centavos: 11250, monto_publicador_centavos: 63750,
    estado: "aceptada",
  }).select("id").single();

  // --- las dos partes conversan ---
  const { error: e1 } = await beto.cliente.from("mensajes").insert({
    reservation_id: reserva.id, autor_id: beto.id, texto: "Buenas, ¿a qué hora lo puedo pasar recogiendo el martes?",
  });
  anotar("Quien renta puede escribir", !e1, e1?.message ?? "enviado");

  const { error: e2 } = await ana.cliente.from("mensajes").insert({
    reservation_id: reserva.id, autor_id: ana.id, texto: "Buenas. De 8 a 5 en la zona 11, cuando guste.",
  });
  anotar("Quien publica puede responder", !e2, e2?.message ?? "enviado");

  const { data: verBeto } = await beto.cliente.from("mensajes").select("texto").eq("reservation_id", reserva.id);
  anotar("Quien renta ve los dos mensajes", (verBeto?.length ?? 0) === 2, `${verBeto?.length ?? 0} mensajes`);
  const { data: verAna } = await ana.cliente.from("mensajes").select("texto").eq("reservation_id", reserva.id);
  anotar("Quien publica ve los dos mensajes", (verAna?.length ?? 0) === 2, `${verAna?.length ?? 0} mensajes`);

  // --- la persona ajena ---
  const { data: verCaro } = await caro.cliente.from("mensajes").select("texto").eq("reservation_id", reserva.id);
  anotar("Una tercera persona NO lee la conversación", (verCaro?.length ?? 0) === 0, `${verCaro?.length ?? 0} mensajes`);

  const { error: eCaro } = await caro.cliente.from("mensajes").insert({
    reservation_id: reserva.id, autor_id: caro.id, texto: "Me colé en la conversación.",
  });
  anotar("Una tercera persona NO puede escribir", !!eCaro, eCaro ? "rechazado por RLS" : "SE GUARDÓ (grave)");

  // --- suplantación: Beto escribiendo como si fuera Ana ---
  const { error: eSup } = await beto.cliente.from("mensajes").insert({
    reservation_id: reserva.id, autor_id: ana.id, texto: "Te lo dejo gratis, no te preocupés.",
  });
  anotar("Nadie puede escribir a nombre del otro", !!eSup, eSup ? "rechazado por RLS" : "SE GUARDÓ (grave)");

  // --- los mensajes no se tocan ---
  const { data: idsMensajes } = await beto.cliente.from("mensajes").select("id").eq("autor_id", beto.id);
  const { data: editado } = await beto.cliente.from("mensajes")
    .update({ texto: "cambiado despues" }).eq("id", idsMensajes[0].id).select("id");
  anotar("Un mensaje enviado no se puede editar", (editado?.length ?? 0) === 0, `${editado?.length ?? 0} modificados`);

  const { data: borrado } = await beto.cliente.from("mensajes").delete().eq("id", idsMensajes[0].id).select("id");
  anotar("Un mensaje enviado no se puede borrar", (borrado?.length ?? 0) === 0, `${borrado?.length ?? 0} borrados`);

  // --- validaciones de contenido ---
  const { error: eVacio } = await beto.cliente.from("mensajes").insert({
    reservation_id: reserva.id, autor_id: beto.id, texto: "   ",
  });
  anotar("Rechaza un mensaje vacío", !!eVacio, eVacio ? "rechazado" : "SE GUARDÓ");

  const { error: eLargo } = await beto.cliente.from("mensajes").insert({
    reservation_id: reserva.id, autor_id: beto.id, texto: "x".repeat(1001),
  });
  anotar("Rechaza un mensaje de más de 1000 letras", !!eLargo, eLargo ? "rechazado" : "SE GUARDÓ");

  // --- el orden de la conversación ---
  const { data: enOrden } = await beto.cliente.from("mensajes")
    .select("texto, creado_en").eq("reservation_id", reserva.id).order("creado_en", { ascending: true });
  anotar("Los mensajes salen en orden cronológico",
    enOrden?.[0]?.texto?.startsWith("Buenas, ¿a qué hora"),
    `primero: "${enOrden?.[0]?.texto?.slice(0, 30)}…"`);
} finally {
  const l = await borrarUsuariosDemo(admin, "ejemplo-prestamo.test");
  anotar("Limpieza", l.fallos.length === 0, `${l.cuentas} cuentas, ${l.reservas} reservas`);
}

let fallos = 0;
console.log("");
for (const r of res) { if (!r.ok) fallos++; console.log(`  ${r.ok ? "OK  " : "FALLA"}  ${r.n.padEnd(50)} ${r.d}`); }
console.log(`\n  ${res.length - fallos} de ${res.length} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
