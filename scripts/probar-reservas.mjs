/**
 * Pruebas de permisos sobre reservas y pagos, con usuarios reales con sesión.
 *
 * CÓMO SE CORRE:   npm run probar:reservas
 * REQUIERE:        la migración 0004 aplicada.
 *
 * QUÉ NO PRUEBA: el cálculo de disponibilidad, que vive en la API y no en la
 * base de datos. Eso lo cubren las 19 pruebas de `npm test`.
 */
import { createClient } from "@supabase/supabase-js";
import { borrarUsuariosDemo } from "./limpiar-demo.mjs";

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_SUPA, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const resultados = [];
const anotar = (n, ok, det) => resultados.push({ n, ok, det });
const creados = [];

async function usuario(etiqueta) {
  const correo = `res-${etiqueta}-${Date.now()}@ejemplo-prestamo.test`;
  const clave = `Clave-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email: correo, password: clave, email_confirm: true });
  if (error) throw new Error(error.message);
  creados.push(data.user.id);
  await admin.from("users").update({ nombre: `Usuario ${etiqueta}`, telefono_whatsapp: "55110000", ciudad: "Mixco" }).eq("id", data.user.id);
  const cliente = createClient(URL_SUPA, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await cliente.auth.signInWithPassword({ email: correo, password: clave });
  if (e2) throw new Error(e2.message);
  return { id: data.user.id, cliente };
}

try {
  const ana = await usuario("ana");     // publica
  const beto = await usuario("beto");   // renta
  const caro = await usuario("caro");   // curiosa

  const { data: item } = await ana.cliente.from("listings").insert({
    user_id: ana.id, titulo: "Andamio de 2 cuerpos", categoria: "herramientas",
    descripcion: "Andamio metálico de dos cuerpos con plataforma de madera.",
    precio_por_dia_centavos: 12000, ciudad: "Mixco", cantidad_disponible: 1,
  }).select("id").single();

  // Q120.00 x 3 días = Q360.00 → 15% = Q54.00, publicador Q306.00
  const base = {
    listing_id: item.id, renter_id: beto.id,
    inicio_en: "2026-11-10", fin_en: "2026-11-12",
    precio_por_dia_centavos: 12000,
    comision_plataforma_centavos: 5400, monto_publicador_centavos: 30600,
    estado: "aceptada",
  };

  const { data: reserva, error: errReserva } = await beto.cliente
    .from("reservations").insert(base).select("id, dias, precio_total_centavos").single();
  anotar("Beto puede reservar el ítem de Ana", !errReserva && !!reserva, errReserva?.message ?? "reservado");
  anotar("La base de datos cuenta 3 días (10 al 12, inclusivo)", reserva?.dias === 3, `dias = ${reserva?.dias}`);
  anotar("La base de datos calcula el total sola", reserva?.precio_total_centavos === 36000,
    `total = ${reserva?.precio_total_centavos}`);

  // El descuadre de dinero tiene que ser imposible.
  const { error: errDescuadre } = await beto.cliente.from("reservations").insert({
    ...base, inicio_en: "2026-12-01", fin_en: "2026-12-03", comision_plataforma_centavos: 1,
  });
  anotar("La base de datos rechaza dinero que no cuadra", !!errDescuadre,
    errDescuadre ? "rechazado por la restricción" : "SE GUARDÓ (grave)");

  // Fin antes que inicio.
  const { error: errRango } = await beto.cliente.from("reservations").insert({
    ...base, inicio_en: "2026-11-20", fin_en: "2026-11-10",
    comision_plataforma_centavos: 0, monto_publicador_centavos: 0,
  });
  anotar("La base de datos rechaza un rango al revés", !!errRango,
    errRango ? "rechazado" : "SE GUARDÓ (grave)");

  // Reservar a nombre de otro.
  const { error: errSuplantar } = await caro.cliente.from("reservations").insert({ ...base, inicio_en: "2026-12-10", fin_en: "2026-12-12" });
  anotar("Caro NO puede reservar a nombre de Beto", !!errSuplantar,
    errSuplantar ? "rechazado por RLS" : "SE GUARDÓ (grave)");

  // Reservarse el ítem de uno mismo.
  const { error: errPropio } = await ana.cliente.from("reservations").insert({
    ...base, renter_id: ana.id, inicio_en: "2026-12-20", fin_en: "2026-12-22",
  });
  anotar("Ana NO puede reservar su propio ítem", !!errPropio,
    errPropio ? "rechazado por RLS" : "SE GUARDÓ (grave)");

  // Quién ve la reserva.
  const { data: veBeto } = await beto.cliente.from("reservations").select("id").eq("id", reserva.id);
  anotar("Beto ve su propia reserva", (veBeto?.length ?? 0) === 1, `${veBeto?.length ?? 0} filas`);
  const { data: veAna } = await ana.cliente.from("reservations").select("id").eq("id", reserva.id);
  anotar("Ana ve la reserva sobre su ítem", (veAna?.length ?? 0) === 1, `${veAna?.length ?? 0} filas`);
  const { data: veCaro } = await caro.cliente.from("reservations").select("id").eq("id", reserva.id);
  anotar("Caro NO ve reservas ajenas", (veCaro?.length ?? 0) === 0, `${veCaro?.length ?? 0} filas`);

  // Nadie borra reservas.
  const { data: borrada } = await beto.cliente.from("reservations").delete().eq("id", reserva.id).select("id");
  anotar("Nadie puede BORRAR una reserva", (borrada?.length ?? 0) === 0, `${borrada?.length ?? 0} borradas`);

  // Pagos.
  const { error: errPago } = await beto.cliente.from("payments").insert({
    reservation_id: reserva.id, monto_centavos: 36000, estado: "retenido", metodo_simulado: "en_linea",
  });
  anotar("Beto registra el pago de su reserva", !errPago, errPago?.message ?? "registrado");

  const { data: vePagoAna } = await ana.cliente.from("payments").select("id").eq("reservation_id", reserva.id);
  anotar("Ana ve el pago de su ítem", (vePagoAna?.length ?? 0) === 1, `${vePagoAna?.length ?? 0} filas`);
  const { data: vePagoCaro } = await caro.cliente.from("payments").select("id").eq("reservation_id", reserva.id);
  anotar("Caro NO ve pagos ajenos", (vePagoCaro?.length ?? 0) === 0, `${vePagoCaro?.length ?? 0} filas`);

  const { data: pagoEditado } = await beto.cliente.from("payments")
    .update({ monto_centavos: 1 }).eq("reservation_id", reserva.id).select("id");
  anotar("Un pago registrado no se puede editar", (pagoEditado?.length ?? 0) === 0,
    `${pagoEditado?.length ?? 0} filas modificadas`);

  // Dos pagos para la misma reserva.
  const { error: errDoble } = await beto.cliente.from("payments").insert({
    reservation_id: reserva.id, monto_centavos: 36000, estado: "retenido",
  });
  anotar("No se puede pagar dos veces la misma reserva", !!errDoble,
    errDoble ? "rechazado" : "SE GUARDÓ (grave)");
} finally {
  // Antes esto decía "borrados" sin comprobar nada, y las cuentas con reservas
  // quedaban dando vueltas: borrar un usuario con historial de dinero está
  // prohibido por la base de datos, a propósito. Ahora se desarma en orden y
  // se verifica de verdad.
  const limpieza = await borrarUsuariosDemo(admin, "ejemplo-prestamo.test");
  anotar("Se limpian los usuarios de prueba", limpieza.fallos.length === 0,
    limpieza.fallos.length === 0
      ? `${limpieza.cuentas} cuentas, ${limpieza.reservas} reservas, ${limpieza.pagos} pagos`
      : limpieza.fallos.join(" / "));
}

let fallos = 0;
console.log("");
for (const r of resultados) {
  if (!r.ok) fallos++;
  console.log(`  ${r.ok ? "OK  " : "FALLA"}  ${r.n.padEnd(50)} ${r.det}`);
}
console.log(`\n  ${resultados.length - fallos} de ${resultados.length} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
