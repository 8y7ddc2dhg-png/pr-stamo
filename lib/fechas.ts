/**
 * Manejo de fechas de reserva.
 *
 * REGLA QUE NO SE ROMPE: las fechas de reserva son solo el DÍA, nunca día y
 * hora. Se representan como texto "AAAA-MM-DD" (ej. "2026-10-15").
 *
 * ¿Por qué texto y no un objeto Date? Porque un Date siempre lleva una hora
 * pegada, y esa hora se interpreta distinto según dónde corra el código. El
 * servidor de Vercel está en UTC y los usuarios están en Guatemala (UTC-6).
 * Una reserva del 15 podría verse como del 14 según quién la mire. Con texto
 * plano, ese problema no existe.
 *
 * REGLA QUE NO SE ROMPE: el rango es INCLUSIVO en ambos extremos.
 * Del 15 al 17 son 3 días, no 2.
 */

export const ZONA_HORARIA = "America/Guatemala";

/** Formato que espera y devuelve todo este archivo: "2026-10-15". */
export type FechaISO = string;

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaValida(fecha: string): fecha is FechaISO {
  if (!PATRON_FECHA.test(fecha)) return false;
  // Verifica que la fecha exista de verdad: rechaza "2026-02-31".
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    d.getUTCFullYear() === anio &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

/**
 * El día de hoy en Guatemala, no en el servidor.
 *
 * Si un usuario reserva a las 8 de la noche del 15, en UTC ya son las 2 de la
 * mañana del 16. Sin esta función, la app le diría que el 15 "ya pasó".
 */
export function hoyEnGuatemala(): FechaISO {
  // "en-CA" da el formato AAAA-MM-DD, que es justo el que necesitamos.
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(
    new Date()
  );
}

/**
 * Cuenta los días de una reserva, con el rango INCLUSIVO.
 * contarDias("2026-10-15", "2026-10-17") → 3
 *
 * Nota: la base de datos calcula esto sola en una columna generada. Esta
 * función existe solo para mostrar el total en pantalla ANTES de guardar.
 * Las dos tienen que dar el mismo resultado, siempre.
 */
export function contarDias(inicio: FechaISO, fin: FechaISO): number {
  if (!esFechaValida(inicio) || !esFechaValida(fin)) {
    throw new Error(`Fechas inválidas: "${inicio}" a "${fin}".`);
  }
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  const diferencia = Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`);
  return Math.round(diferencia / MS_POR_DIA) + 1;
}

/** Suma (o resta, con número negativo) días a una fecha. */
export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  if (!esFechaValida(fecha)) throw new Error(`Fecha inválida: "${fecha}".`);
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * MS_POR_DIA)
    .toISOString()
    .slice(0, 10);
}

/**
 * Revisa que un rango sirva para reservar. Devuelve null si está bien, o el
 * mensaje de error listo para mostrarle a una persona (no a un programador).
 */
export function validarRango(
  inicio: string,
  fin: string
): string | null {
  if (!esFechaValida(inicio)) return "Elegí una fecha de inicio válida.";
  if (!esFechaValida(fin)) return "Elegí una fecha de entrega válida.";
  if (fin < inicio) return "La fecha de entrega no puede ser antes de la de inicio.";
  if (inicio < hoyEnGuatemala()) return "No podés reservar fechas que ya pasaron.";
  if (contarDias(inicio, fin) > 90) return "La renta no puede durar más de 90 días.";
  return null;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-10-15" → "15 de octubre de 2026" */
export function formatearFecha(fecha: FechaISO): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

/** "2026-10-15" a "2026-10-17" → "del 15 al 17 de octubre de 2026" */
export function formatearRango(inicio: FechaISO, fin: FechaISO): string {
  const [anioI, mesI, diaI] = inicio.split("-").map(Number);
  const [anioF, mesF, diaF] = fin.split("-").map(Number);

  if (anioI === anioF && mesI === mesF) {
    if (diaI === diaF) return `el ${diaI} de ${MESES[mesI - 1]} de ${anioI}`;
    return `del ${diaI} al ${diaF} de ${MESES[mesI - 1]} de ${anioI}`;
  }
  return `del ${formatearFecha(inicio)} al ${formatearFecha(fin)}`;
}
