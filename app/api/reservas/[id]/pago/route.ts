import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * ⚠️⚠️  PAGO SIMULADO — NO COBRA NADA  ⚠️⚠️
 *
 * Esto marca una reserva como pagada sin que haya existido ningún cobro.
 * Es exactamente lo que la regla 5 de CLAUDE.md prohíbe, y con razón: si el
 * navegador puede declarar un pago, cualquiera se regala reservas.
 *
 * Existe SOLO para poder mostrar el circuito completo en una demostración
 * académica. Tres candados para que nunca se confunda con un cobro real:
 *
 *   1. Solo funciona si PAGOS_SIMULADOS vale exactamente "true". En cualquier
 *      despliegue donde esa variable no esté, este endpoint devuelve un error.
 *   2. La pantalla muestra un cartel de "simulado" bien visible.
 *   3. Queda anotado como deuda en PLAN.md, para borrarlo cuando entre
 *      Recurrente de verdad.
 *
 * CUANDO SE CONECTE EL PAGO REAL: este archivo se borra entero. No se adapta.
 */
export async function POST(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.PAGOS_SIMULADOS !== "true") {
    return NextResponse.json(
      { error: "Los pagos simulados están apagados en este sitio." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás ingresar." }, { status: 401 });
  }

  const cuerpo = await _peticion.json().catch(() => ({}));
  const metodo = String((cuerpo as Record<string, unknown>).metodo ?? "");
  if (metodo !== "en_linea" && metodo !== "efectivo") {
    return NextResponse.json({ error: "Elegí cómo querés pagar." }, { status: 400 });
  }

  // Se lee la reserva del usuario. RLS ya limita a las propias, pero el filtro
  // explícito deja la intención escrita y no solo aplicada.
  const { data: reserva } = await supabase
    .from("reservations")
    .select("id, estado, precio_total_centavos, renter_id")
    .eq("id", id)
    .eq("renter_id", user.id)
    .single();

  if (!reserva) {
    return NextResponse.json({ error: "No encontramos esa reserva." }, { status: 404 });
  }

  // Solo se paga lo que está aceptado. Sin esta verificación se podría "pagar"
  // dos veces, o pagar algo ya cancelado.
  if (reserva.estado !== "aceptada") {
    const explicacion =
      reserva.estado === "pagada"
        ? "Esa reserva ya está pagada."
        : "Esa reserva no está en estado de pagarse.";
    return NextResponse.json({ error: explicacion }, { status: 409 });
  }

  const { error: errorPago } = await supabase.from("payments").insert({
    reservation_id: reserva.id,
    monto_centavos: reserva.precio_total_centavos,
    estado: "retenido",
    metodo_simulado: metodo,
    notas_admin: "PAGO SIMULADO — demo académica, no hubo cobro real.",
  });

  if (errorPago) {
    return NextResponse.json({ error: "No se pudo registrar el pago." }, { status: 500 });
  }

  const { error: errorEstado } = await supabase
    .from("reservations")
    .update({ estado: "pagada" })
    .eq("id", reserva.id);

  if (errorEstado) {
    return NextResponse.json({ error: "No se pudo actualizar la reserva." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
