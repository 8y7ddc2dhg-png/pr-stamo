import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Mandar un mensaje.
 *
 * El autor sale de la SESIÓN, nunca del cuerpo de la petición. Si viniera del
 * navegador, cualquiera podría escribir haciéndose pasar por la otra persona,
 * que en una conversación sobre entregas y dinero es exactamente lo peor que
 * podría pasar.
 *
 * Quién puede escribir en qué conversación lo decide RLS: hay que ser una de
 * las dos partes de esa reserva. Acá no hace falta repetir esa verificación,
 * pero sí traducir el rechazo a un mensaje entendible.
 */
export async function POST(peticion: Request) {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás ingresar." }, { status: 401 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await peticion.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "No entendimos el mensaje." }, { status: 400 });
  }

  const reservationId = String(cuerpo.reservation_id ?? "");
  const texto = String(cuerpo.texto ?? "").trim();

  if (!texto) {
    return NextResponse.json({ error: "Escribí algo antes de enviar." }, { status: 400 });
  }
  if (texto.length > 1000) {
    return NextResponse.json(
      { error: "El mensaje es muy largo. Máximo 1000 letras." },
      { status: 400 }
    );
  }

  const { data: mensaje, error } = await supabase
    .from("mensajes")
    .insert({ reservation_id: reservationId, autor_id: user.id, texto })
    .select("id, texto, autor_id, creado_en")
    .single();

  if (error || !mensaje) {
    // El rechazo típico acá es de RLS: alguien intentando escribir en una
    // conversación que no es suya. No se le explica el mecanismo.
    return NextResponse.json(
      { error: "No se pudo enviar el mensaje." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, mensaje });
}
