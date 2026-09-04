/**
 * Las ciudades donde opera la plataforma.
 *
 * Arrancamos concentrados en la Ciudad de Guatemala y municipios vecinos.
 * Un catálogo de 25 ítems repartidos por todo el país se ve abandonado; los
 * mismos 25 concentrados en una zona se ven útiles (ver PLAN.md sección 6).
 *
 * La lista crece cuando haya demanda real, no antes.
 */

export const CIUDADES = [
  "Ciudad de Guatemala",
  "Mixco",
  "Villa Nueva",
  "San Miguel Petapa",
  "Santa Catarina Pinula",
  "San José Pinula",
  "Villa Canales",
  "Fraijanes",
  "Chinautla",
  "San Juan Sacatepéquez",
  "Antigua Guatemala",
] as const;

export type Ciudad = (typeof CIUDADES)[number];

export function esCiudadValida(valor: string): valor is Ciudad {
  return (CIUDADES as readonly string[]).includes(valor);
}
