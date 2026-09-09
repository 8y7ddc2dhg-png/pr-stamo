import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { comisionPlataforma } from "@/lib/entorno";
import { normalizarTelefono, validarNombre } from "@/lib/validaciones";
import { validarRango } from "@/lib/fechas";

/**
 * Confirmar la compra del carrito.
 *
 * Este endpoint NO decide si hay disponibilidad ni calcula precios: los lee la
 * base de datos. Lo único que llega del navegador son los identificadores y
 * las fechas. Si el precio viniera de la pantalla, cualquiera podría comprar
 * una carpa de Q400 por Q1 cambiando un número antes de enviar.
 *
 * Toda la creación ocurre dentro de `crear_pedidos_del_carrito`, una función
 * de base de datos que corre en UNA SOLA transacción: si cualquier ítem ya no
 * está libre, levanta un error y no queda nada creado. Es la única forma de
 * cumplir "si alguna no está disponible, no crees nada" sin cruzar los dedos.
 */
export async function POST(peticion: Request) {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás ingresar para confirmar." }, { status: 401 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await peticion.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "No entendimos los datos enviados." }, { status: 400 });
  }

  const lineas = Array.isArray(cuerpo.lineas) ? cuerpo.lineas : [];
  if (lineas.length === 0) {
    return NextResponse.json({ error: "Tu carrito está vacío." }, { status: 400 });
  }
  if (lineas.length > 20) {
    return NextResponse.json({ error: "Son demasiados ítems para un solo pedido." }, { status: 400 });
  }

  // --- Datos de contacto ---
  const nombre = String(cuerpo.nombre ?? "").trim();
  const apellido = String(cuerpo.apellido ?? "").trim();
  const correo = String(cuerpo.correo ?? "").trim();

  const errorNombre = validarNombre(nombre);
  if (errorNombre) return NextResponse.json({ error: errorNombre }, { status: 400 });

  const errorApellido = validarNombre(apellido);
  if (errorApellido) return NextResponse.json({ error: "Escribí tu apellido." }, { status: 400 });

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return NextResponse.json({ error: "Ese correo no parece válido." }, { status: 400 });
  }

  const telefono = normalizarTelefono(String(cuerpo.telefono ?? ""));
  if (!telefono) {
    return NextResponse.json(
      { error: "Ese número no parece de Guatemala. Son 8 dígitos, por ejemplo 5512-3456." },
      { status: 400 }
    );
  }

  // --- Entrega ---
  const tipoEntrega = String(cuerpo.tipo_entrega ?? "");
  if (tipoEntrega !== "recoger" && tipoEntrega !== "domicilio") {
    return NextResponse.json({ error: "Elegí cómo querés recibir las cosas." }, { status: 400 });
  }

  const direccion = String(cuerpo.direccion ?? "").trim();
  const zona = String(cuerpo.zona ?? "").trim();

  if (tipoEntrega === "domicilio" && direccion.length < 8) {
    return NextResponse.json(
      { error: "Escribí la dirección completa para poder llevártelo." },
      { status: 400 }
    );
  }

  // --- Pago ---
  const metodo = cuerpo.metodo_pago == null ? null : String(cuerpo.metodo_pago);
  if (metodo !== null && metodo !== "efectivo" && metodo !== "en_linea") {
    return NextResponse.json({ error: "Elegí cómo querés pagar." }, { status: 400 });
  }

  // El mismo candado que el resto de la demo: sin la variable encendida, no se
  // registran pagos simulados.
  if (metodo !== null && process.env.PAGOS_SIMULADOS !== "true") {
    return NextResponse.json(
      { error: "Los pagos simulados están apagados en este sitio." },
      { status: 403 }
    );
  }

  // --- Las líneas ---
  const paraLaBase: { listing_id: string; inicio_en: string; fin_en: string }[] = [];
  for (const cruda of lineas) {
    const l = cruda as Record<string, unknown>;
    const listingId = String(l.listingId ?? l.listing_id ?? "");
    const inicio = String(l.inicio ?? l.inicio_en ?? "");
    const fin = String(l.fin ?? l.fin_en ?? "");

    if (!listingId) {
      return NextResponse.json({ error: "Hay un ítem del carrito sin identificar." }, { status: 400 });
    }
    const problema = validarRango(inicio, fin);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });

    paraLaBase.push({ listing_id: listingId, inicio_en: inicio, fin_en: fin });
  }

  const { data, error } = await supabase.rpc("crear_pedidos_del_carrito", {
    p_lineas: paraLaBase,
    p_nombre: nombre,
    p_apellido: apellido,
    p_correo: correo,
    p_telefono: telefono,
    p_tipo_entrega: tipoEntrega,
    p_direccion: tipoEntrega === "domicilio" ? direccion : null,
    p_zona: tipoEntrega === "domicilio" ? zona : null,
    p_comision: comisionPlataforma(),
    p_metodo_pago: metodo,
  });

  if (error) {
    // Los mensajes de la función están escritos para una persona ("Ya no hay
    // cupo para X en esas fechas"), así que se pasan tal cual. Todo lo demás
    // se traduce a algo genérico para no filtrar detalles internos.
    const suyo = error.message?.includes("cupo")
      || error.message?.includes("disponible")
      || error.message?.includes("fechas")
      || error.message?.includes("propios")
      || error.message?.includes("carrito");

    return NextResponse.json(
      { error: suyo ? error.message : "No se pudo confirmar el pedido. Intentá de nuevo." },
      { status: suyo ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true, pedidos: data ?? [] });
}
