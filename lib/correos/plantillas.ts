import { formatearQuetzales } from "@/lib/dinero";
import { formatearRango, type FechaISO } from "@/lib/fechas";
import { urlSitio } from "@/lib/entorno";
import type { Correo } from "@/lib/correos/enviar";

/**
 * El texto de cada correo que manda la app.
 *
 * Están todos juntos acá para que se puedan leer y corregir sin buscarlos por
 * el código. Cada uno se manda en HTML y en texto plano: hay clientes de correo
 * —y filtros de spam— que solo miran la versión de texto.
 *
 * Se arman con plantillas simples en vez de una librería de plantillas: son
 * tres correos cortos, y una dependencia más sería un costo sin beneficio.
 */

/** Escapa el texto que escribió una persona, para que no rompa el HTML. */
function seguro(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function envoltura(titulo: string, cuerpo: string, enlace: string, textoEnlace: string): string {
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 16px">${titulo}</h1>
  ${cuerpo}
  <p style="margin:24px 0 0">
    <a href="${enlace}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:500">${textoEnlace}</a>
  </p>
  <p style="margin:24px 0 0;font-size:13px;color:#64748b">
    Prestamo — rentá lo que necesitás, por los días que lo necesitás.
  </p>
</div>`;
}

type DatosDeReserva = {
  para: string;
  nombreDelOtro: string;
  tituloDelItem: string;
  inicio: FechaISO;
  fin: FechaISO;
  totalCentavos: number;
  reservaId: string;
};

/** Al publicador: alguien le reservó algo. */
export function nuevaReserva(d: DatosDeReserva): Correo {
  const enlace = `${urlSitio()}/reserva/${d.reservaId}`;
  const rango = formatearRango(d.inicio, d.fin);
  const total = formatearQuetzales(d.totalCentavos);

  return {
    para: d.para,
    asunto: `Nueva reserva: ${d.tituloDelItem}`,
    html: envoltura(
      "Te hicieron una reserva",
      `<p style="margin:0 0 12px"><strong>${seguro(d.nombreDelOtro)}</strong> reservó
       <strong>${seguro(d.tituloDelItem)}</strong> ${seguro(rango)}.</p>
       <p style="margin:0">Total: <strong>${total}</strong>.</p>
       <p style="margin:12px 0 0">Entrá para ver los detalles y coordinar la entrega por el chat.</p>`,
      enlace,
      "Ver la reserva"
    ),
    texto: `Te hicieron una reserva.

${d.nombreDelOtro} reservó "${d.tituloDelItem}" ${rango}.
Total: ${total}.

Entrá para ver los detalles y coordinar la entrega:
${enlace}`,
  };
}

/** Al publicador: la reserva ya fue pagada. */
export function reservaPagada(d: DatosDeReserva & { metodo: string }): Correo {
  const enlace = `${urlSitio()}/reserva/${d.reservaId}`;
  const comoPago = d.metodo === "efectivo" ? "en efectivo al recibir" : "en línea";
  const total = formatearQuetzales(d.totalCentavos);

  return {
    para: d.para,
    asunto: `Pago recibido: ${d.tituloDelItem}`,
    html: envoltura(
      "Ya te pagaron la reserva",
      `<p style="margin:0 0 12px"><strong>${seguro(d.nombreDelOtro)}</strong> pagó
       <strong>${total}</strong> por <strong>${seguro(d.tituloDelItem)}</strong>
       (${comoPago}).</p>
       <p style="margin:0">Fechas: ${seguro(formatearRango(d.inicio, d.fin))}.</p>
       <p style="margin:12px 0 0">Ya podés coordinar la entrega.</p>`,
      enlace,
      "Ver la reserva"
    ),
    texto: `Ya te pagaron la reserva.

${d.nombreDelOtro} pagó ${total} por "${d.tituloDelItem}" (${comoPago}).
Fechas: ${formatearRango(d.inicio, d.fin)}.

Ver la reserva:
${enlace}`,
  };
}

/** A cualquiera de las dos partes: le escribieron en el chat. */
export function mensajeNuevo(d: {
  para: string;
  nombreDelOtro: string;
  tituloDelItem: string;
  texto: string;
  reservaId: string;
}): Correo {
  const enlace = `${urlSitio()}/reserva/${d.reservaId}`;
  const recorte = d.texto.length > 200 ? `${d.texto.slice(0, 200)}…` : d.texto;

  return {
    para: d.para,
    asunto: `${d.nombreDelOtro} te escribió sobre ${d.tituloDelItem}`,
    html: envoltura(
      `${seguro(d.nombreDelOtro)} te escribió`,
      `<p style="margin:0 0 12px;color:#64748b">Sobre <strong>${seguro(d.tituloDelItem)}</strong>:</p>
       <blockquote style="margin:0;padding:12px 16px;background:#f1f5f9;border-radius:8px">
         ${seguro(recorte)}
       </blockquote>`,
      enlace,
      "Responder"
    ),
    texto: `${d.nombreDelOtro} te escribió sobre "${d.tituloDelItem}":

"${recorte}"

Responder:
${enlace}`,
  };
}
