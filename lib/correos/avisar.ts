import { crearClienteAdmin } from "@/lib/supabase/server";
import { enviarCorreo } from "@/lib/correos/enviar";
import { nuevaReserva, reservaPagada, mensajeNuevo } from "@/lib/correos/plantillas";

/**
 * Los avisos por correo de la app.
 *
 * POR QUÉ USA EL CLIENTE DE ADMINISTRADOR: para mandarle un correo a alguien
 * hay que saber su dirección, y la regla de seguridad sobre `users` solo deja
 * leer la fila propia —a propósito, porque ahí también están el teléfono y los
 * datos bancarios—. Este código corre en el servidor, la dirección se usa solo
 * para el envío y nunca vuelve al navegador.
 *
 * NADA DE ACÁ PUEDE FALLAR HACIA AFUERA. Todas las funciones atrapan cualquier
 * error y devuelven en silencio. Que Resend esté caído, o que falte la llave,
 * no puede impedir que se guarde una reserva o que se envíe un mensaje.
 */

type ContextoDeReserva = {
  reservaId: string;
  tituloDelItem: string;
  inicio: string;
  fin: string;
  totalCentavos: number;
  publicadorId: string;
  renterId: string;
};

async function leerContexto(reservaId: string): Promise<ContextoDeReserva | null> {
  const admin = crearClienteAdmin();
  const { data } = await admin
    .from("reservations")
    .select("id, inicio_en, fin_en, precio_total_centavos, renter_id, listings ( titulo, user_id )")
    .eq("id", reservaId)
    .single();

  if (!data) return null;
  const item = Array.isArray(data.listings) ? data.listings[0] : data.listings;
  if (!item) return null;

  return {
    reservaId: data.id,
    tituloDelItem: item.titulo,
    inicio: data.inicio_en,
    fin: data.fin_en,
    totalCentavos: data.precio_total_centavos,
    publicadorId: item.user_id,
    renterId: data.renter_id,
  };
}

async function datosDe(usuarioId: string): Promise<{ correo: string; nombre: string } | null> {
  const admin = crearClienteAdmin();
  const { data } = await admin.from("users").select("correo, nombre").eq("id", usuarioId).single();
  if (!data?.correo) return null;
  return { correo: data.correo, nombre: data.nombre ?? "Alguien" };
}

/** Al publicador: le reservaron algo. */
export async function avisarNuevaReserva(reservaId: string): Promise<void> {
  try {
    const ctx = await leerContexto(reservaId);
    if (!ctx) return;

    const publicador = await datosDe(ctx.publicadorId);
    const quienRenta = await datosDe(ctx.renterId);
    if (!publicador || !quienRenta) return;

    await enviarCorreo(
      nuevaReserva({
        para: publicador.correo,
        nombreDelOtro: quienRenta.nombre,
        tituloDelItem: ctx.tituloDelItem,
        inicio: ctx.inicio,
        fin: ctx.fin,
        totalCentavos: ctx.totalCentavos,
        reservaId: ctx.reservaId,
      })
    );
  } catch (fallo) {
    console.error("[correos] avisarNuevaReserva falló:", fallo);
  }
}

/** Al publicador: ya le pagaron. */
export async function avisarPago(reservaId: string, metodo: string): Promise<void> {
  try {
    const ctx = await leerContexto(reservaId);
    if (!ctx) return;

    const publicador = await datosDe(ctx.publicadorId);
    const quienRenta = await datosDe(ctx.renterId);
    if (!publicador || !quienRenta) return;

    await enviarCorreo(
      reservaPagada({
        para: publicador.correo,
        nombreDelOtro: quienRenta.nombre,
        tituloDelItem: ctx.tituloDelItem,
        inicio: ctx.inicio,
        fin: ctx.fin,
        totalCentavos: ctx.totalCentavos,
        reservaId: ctx.reservaId,
        metodo,
      })
    );
  } catch (fallo) {
    console.error("[correos] avisarPago falló:", fallo);
  }
}

/** A la otra parte: le escribieron en el chat. */
export async function avisarMensaje(
  reservaId: string,
  autorId: string,
  texto: string
): Promise<void> {
  try {
    const ctx = await leerContexto(reservaId);
    if (!ctx) return;

    // El aviso va a la parte que NO escribió.
    const destinatarioId = autorId === ctx.renterId ? ctx.publicadorId : ctx.renterId;
    const destinatario = await datosDe(destinatarioId);
    const autor = await datosDe(autorId);
    if (!destinatario || !autor) return;

    await enviarCorreo(
      mensajeNuevo({
        para: destinatario.correo,
        nombreDelOtro: autor.nombre,
        tituloDelItem: ctx.tituloDelItem,
        texto,
        reservaId: ctx.reservaId,
      })
    );
  } catch (fallo) {
    console.error("[correos] avisarMensaje falló:", fallo);
  }
}
