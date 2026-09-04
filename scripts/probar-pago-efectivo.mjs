/**
 * Comprueba que el pago en efectivo funcione igual que el de en línea.
 * CÓMO SE CORRE:  node --env-file=.env.local scripts/probar-pago-efectivo.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { borrarUsuariosDemo } from "./limpiar-demo.mjs";

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_SUPA, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const res = [];
const anotar = (n, ok, d) => res.push({ n, ok, d });

async function usuario(e) {
  const correo = `efec-${e}-${Date.now()}@ejemplo-prestamo.test`;
  const clave = `C-${crypto.randomUUID()}`;
  const { data } = await admin.auth.admin.createUser({ email: correo, password: clave, email_confirm: true });
  await admin.from("users").update({ nombre: `U ${e}`, telefono_whatsapp: "55110000", ciudad: "Mixco" }).eq("id", data.user.id);
  const c = createClient(URL_SUPA, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: correo, password: clave });
  return { id: data.user.id, cliente: c };
}

try {
  const ana = await usuario("ana"), beto = await usuario("beto");
  const { data: item } = await ana.cliente.from("listings").insert({
    user_id: ana.id, titulo: "Mesa plegable de 2 metros", categoria: "mobiliario_eventos",
    descripcion: "Mesa plegable de dos metros, ideal para eventos y ferias.",
    precio_por_dia_centavos: 5000, ciudad: "Mixco", cantidad_disponible: 1,
  }).select("id").single();

  for (const metodo of ["efectivo", "en_linea"]) {
    const { data: r } = await beto.cliente.from("reservations").insert({
      listing_id: item.id, renter_id: beto.id,
      inicio_en: metodo === "efectivo" ? "2027-01-10" : "2027-02-10",
      fin_en: metodo === "efectivo" ? "2027-01-11" : "2027-02-11",
      precio_por_dia_centavos: 5000,
      comision_plataforma_centavos: 1500, monto_publicador_centavos: 8500,
      estado: "aceptada",
    }).select("id, precio_total_centavos").single();

    const { error } = await beto.cliente.from("payments").insert({
      reservation_id: r.id, monto_centavos: r.precio_total_centavos,
      estado: "retenido", metodo_simulado: metodo,
    });
    anotar(`Se registra el pago "${metodo}"`, !error, error?.message ?? "registrado");

    const { data: leido } = await beto.cliente.from("payments")
      .select("metodo_simulado, monto_centavos").eq("reservation_id", r.id).single();
    anotar(`El método "${metodo}" queda guardado`, leido?.metodo_simulado === metodo,
      `guardó "${leido?.metodo_simulado}"`);
    anotar(`El monto del pago "${metodo}" es Q100.00`, leido?.monto_centavos === 10000,
      `${leido?.monto_centavos} centavos`);
  }

  const { error: errInventado } = await beto.cliente.from("payments").insert({
    reservation_id: (await beto.cliente.from("reservations").select("id").limit(1).single()).data.id,
    monto_centavos: 1, estado: "retenido", metodo_simulado: "criptomonedas",
  });
  anotar("Rechaza un método de pago inventado", !!errInventado,
    errInventado ? "rechazado por la base de datos" : "SE GUARDÓ (grave)");
} finally {
  const l = await borrarUsuariosDemo(admin, "ejemplo-prestamo.test");
  anotar("Limpieza", l.fallos.length === 0, `${l.cuentas} cuentas, ${l.reservas} reservas, ${l.pagos} pagos`);
}

let fallos = 0;
console.log("");
for (const r of res) { if (!r.ok) fallos++; console.log(`  ${r.ok ? "OK  " : "FALLA"}  ${r.n.padEnd(46)} ${r.d}`); }
console.log(`\n  ${res.length - fallos} de ${res.length} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
