import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { validarRango, contarDias } from "@/lib/fechas";
import { hayDisponibilidad } from "@/lib/disponibilidad";
import { repartirDinero } from "@/lib/comision";

/**
 * Crear una reserva.
 *
 * El precio NO viene del navegador: se lee del ítem en la base de datos. Si
 * confiáramos en el precio que manda la pantalla, cualquiera podría reservar
 * una carpa de Q400 por Q1 cambiando un número antes de enviar.
 *
 * NOTA DE DEMO: acá la reserva queda 'aceptada' de una vez. En el diseño real
 * (PLAN.md sección 3) el publicador tiene que aceptarla primero. Se saltó ese
 * paso para que la demostración se pueda hacer con una sola persona.
 */
export async function POST(peticion: Request) {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás ingresar para reservar." }, { status: 401 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await peticion.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "No entendimos los datos enviados." }, { status: 400 });
  }

  const listingId = String(cuerpo.listing_id ?? "");
  const inicio = String(cuerpo.inicio_en ?? "");
  const fin = String(cuerpo.fin_en ?? "");

  const problemaDeFechas = validarRango(inicio, fin);
  if (problemaDeFechas) {
    return NextResponse.json({ error: problemaDeFechas }, { status: 400 });
  }

  const { data: item } = await supabase
    .from("listings")
    .select("id, user_id, precio_por_dia_centavos, cantidad_disponible, activo, titulo")
    .eq("id", listingId)
    .single();

  if (!item || !item.activo) {
    return NextResponse.json({ error: "Ese ítem ya no está disponible." }, { status: 404 });
  }

  if (item.user_id === user.id) {
    return NextResponse.json({ error: "No podés reservar tu propio ítem." }, { status: 400 });
  }

  // Las reservas que ya ocupan lugar. Las canceladas y rechazadas no cuentan.
  const { data: ocupadas } = await supabase
    .from("reservations")
    .select("inicio_en, fin_en")
    .eq("listing_id", item.id)
    .in("estado", ["solicitada", "aceptada", "pagada", "entregada"])
    .lte("inicio_en", fin)
    .gte("fin_en", inicio);

  if (!hayDisponibilidad(inicio, fin, item.cantidad_disponible, ocupadas ?? [])) {
    return NextResponse.json(
      { error: "Ya está reservado en alguna de esas fechas. Probá con otras." },
      { status: 409 }
    );
  }

  const dias = contarDias(inicio, fin);
  const total = item.precio_por_dia_centavos * dias;
  const reparto = repartirDinero(total);

  // La base de datos vuelve a calcular los días y el total sola, en columnas
  // generadas, y exige que comisión + publicador den exactamente ese total.
  // Si nuestro cálculo no coincidiera con el suyo, la inserción falla. Es una
  // red de seguridad, no una formalidad.
  const { data: reserva, error } = await supabase
    .from("reservations")
    .insert({
      listing_id: item.id,
      renter_id: user.id,
      inicio_en: inicio,
      fin_en: fin,
      precio_por_dia_centavos: item.precio_por_dia_centavos,
      comision_plataforma_centavos: reparto.comisionCentavos,
      monto_publicador_centavos: reparto.publicadorCentavos,
      estado: "aceptada",
    })
    .select("id")
    .single();

  if (error || !reserva) {
    return NextResponse.json(
      { error: "No se pudo crear la reserva. Intentá de nuevo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: reserva.id });
}
