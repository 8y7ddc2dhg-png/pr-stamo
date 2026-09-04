/**
 * El cálculo de la comisión de la plataforma. UN SOLO LUGAR.
 *
 * Está en un archivo propio y con pruebas porque es dinero: si el porcentaje
 * se calculara en dos pantallas distintas, tarde o temprano una quedaría
 * desactualizada y los números dejarían de cuadrar.
 *
 * El porcentaje sale de la variable COMISION_PLATAFORMA (0.15 = 15%), así que
 * se puede bajar a 0 durante un lanzamiento sin tocar código.
 */
import { comisionPlataforma } from "./entorno.ts";

export type RepartoDelDinero = {
  totalCentavos: number;
  comisionCentavos: number;
  publicadorCentavos: number;
};

/**
 * Reparte el total entre la plataforma y quien publica.
 *
 * REDONDEO: a veces el porcentaje no da un número entero de centavos. Q99.99
 * al 15% son 1499.85 centavos, que no existen. Se redondea la comisión al
 * centavo más cercano y el publicador se lleva exactamente el resto. De esa
 * forma las dos partes SIEMPRE suman el total, que es lo que exige la
 * restricción `reservations_cuadra_el_dinero` de la base de datos.
 */
export function repartirDinero(
  totalCentavos: number,
  porcentaje: number = comisionPlataforma()
): RepartoDelDinero {
  if (!Number.isInteger(totalCentavos) || totalCentavos < 0) {
    throw new Error(
      `repartirDinero recibió ${totalCentavos}. El dinero va en centavos enteros.`
    );
  }
  if (!(porcentaje >= 0 && porcentaje <= 1)) {
    throw new Error(`El porcentaje de comisión (${porcentaje}) tiene que estar entre 0 y 1.`);
  }

  const comisionCentavos = Math.round(totalCentavos * porcentaje);
  return {
    totalCentavos,
    comisionCentavos,
    publicadorCentavos: totalCentavos - comisionCentavos,
  };
}
