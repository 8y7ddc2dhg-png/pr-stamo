/**
 * ¿Está libre este ítem en estas fechas?
 *
 * Esta es la pieza de mayor riesgo del proyecto. Un error acá significa dos
 * personas peleándose por el mismo taladro el mismo día. Por eso tiene sus
 * propias pruebas en lib/disponibilidad.test.ts.
 *
 * LA REGLA: para un ítem con N unidades, un rango nuevo se puede reservar solo
 * si NINGÚN día de ese rango ya tiene N reservas encima.
 *
 * EL ERROR CLÁSICO que esto evita: contar cuántas reservas se traslapan con el
 * rango pedido y compararlo con N. Está mal. Tres reservas pueden traslaparse
 * con el rango pedido sin traslaparse entre sí, y en ese caso ningún día
 * concreto llega a tres. Hay que mirar día por día.
 */
import { contarDias, sumarDias, type FechaISO } from "./fechas.ts";

export type RangoReservado = { inicio_en: FechaISO; fin_en: FechaISO };

/**
 * Dos rangos se traslapan si uno empieza antes de que el otro termine, y
 * termina después de que el otro empiece. Ambos extremos son INCLUSIVOS: si
 * una reserva va del 10 al 12 y otra del 12 al 14, el día 12 lo quieren las dos.
 */
export function seTraslapan(a: RangoReservado, b: RangoReservado): boolean {
  return a.inicio_en <= b.fin_en && a.fin_en >= b.inicio_en;
}

/**
 * El día más ocupado dentro del rango pedido: cuántas reservas se le enciman.
 * Se recorre día por día, que es la única forma correcta (ver arriba).
 */
export function ocupacionMaxima(
  inicio: FechaISO,
  fin: FechaISO,
  reservados: RangoReservado[]
): number {
  let maximo = 0;
  const dias = contarDias(inicio, fin);

  for (let i = 0; i < dias; i++) {
    const dia = sumarDias(inicio, i);
    let ocupadoEseDia = 0;
    for (const r of reservados) {
      if (r.inicio_en <= dia && r.fin_en >= dia) ocupadoEseDia++;
    }
    if (ocupadoEseDia > maximo) maximo = ocupadoEseDia;
  }

  return maximo;
}

/** ¿Caben las fechas pedidas? */
export function hayDisponibilidad(
  inicio: FechaISO,
  fin: FechaISO,
  cantidadDisponible: number,
  reservados: RangoReservado[]
): boolean {
  return ocupacionMaxima(inicio, fin, reservados) < cantidadDisponible;
}

/**
 * Los días que ya no se pueden reservar, para pintarlos en gris en el
 * calendario. Se mira desde hoy hacia adelante, la cantidad de días que se pida.
 */
export function diasSinCupo(
  desde: FechaISO,
  cuantosDias: number,
  cantidadDisponible: number,
  reservados: RangoReservado[]
): FechaISO[] {
  const llenos: FechaISO[] = [];

  for (let i = 0; i < cuantosDias; i++) {
    const dia = sumarDias(desde, i);
    let ocupado = 0;
    for (const r of reservados) {
      if (r.inicio_en <= dia && r.fin_en >= dia) ocupado++;
    }
    if (ocupado >= cantidadDisponible) llenos.push(dia);
  }

  return llenos;
}
