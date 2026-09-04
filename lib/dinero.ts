/**
 * Manejo de dinero.
 *
 * REGLA QUE NO SE ROMPE: el dinero se guarda y se calcula SIEMPRE en centavos
 * enteros. Q125.50 es el número 12550, nunca 125.50.
 *
 * ¿Por qué? Las computadoras cometen errores diminutos con decimales:
 * 0.1 + 0.2 da 0.30000000000000004. Con dinero eso se acumula hasta que un
 * total no cuadra por un centavo y nadie entiende por qué. Con enteros ese
 * error es imposible.
 *
 * Solo se divide entre 100 al momento de mostrar en pantalla.
 */

/**
 * Convierte centavos a texto para mostrar: 12550 → "Q125.50".
 *
 * Se formatea a mano en vez de usar Intl.NumberFormat porque el formato tiene
 * que ser idéntico en el servidor y en el navegador. Si difieren aunque sea en
 * un espacio, React se queja de que el HTML no coincide.
 */
export function formatearQuetzales(centavos: number): string {
  if (!Number.isInteger(centavos)) {
    throw new Error(
      `formatearQuetzales recibió ${centavos}, que no es un entero. ` +
        `El dinero siempre va en centavos enteros (Q125.50 = 12550).`
    );
  }

  const esNegativo = centavos < 0;
  const absoluto = Math.abs(centavos);

  const parteEntera = Math.floor(absoluto / 100);
  const parteDecimal = absoluto % 100;

  // Separador de miles: 1250000 → "12,500"
  const enteroConComas = parteEntera
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const signo = esNegativo ? "-" : "";
  return `${signo}Q${enteroConComas}.${parteDecimal.toString().padStart(2, "0")}`;
}

/**
 * Convierte lo que el usuario escribe en un formulario a centavos enteros.
 * "125.50" → 12550. "125" → 12500. "Q1,250.50" → 125050.
 *
 * Devuelve null si no se entiende, para que la pantalla pueda mostrar un
 * mensaje amable en vez de guardar basura.
 */
export function aCentavos(texto: string | number): number | null {
  const limpio =
    typeof texto === "number"
      ? texto.toString()
      : texto.trim().replace(/^Q/i, "").replace(/,/g, "").trim();

  if (limpio === "" || !/^\d+(\.\d{1,2})?$/.test(limpio)) return null;

  // Se multiplica y se redondea porque 125.55 * 100 puede dar 12554.999...
  return Math.round(Number(limpio) * 100);
}

/**
 * Multiplica un precio por días. Existe como función propia para que el
 * cálculo del total viva en un solo lugar y no se repita mal en otra pantalla.
 */
export function multiplicarPorDias(
  precioPorDiaCentavos: number,
  dias: number
): number {
  if (!Number.isInteger(precioPorDiaCentavos) || !Number.isInteger(dias)) {
    throw new Error("multiplicarPorDias solo acepta enteros.");
  }
  return precioPorDiaCentavos * dias;
}
