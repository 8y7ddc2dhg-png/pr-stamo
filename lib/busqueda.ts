/**
 * Limpieza del texto de búsqueda.
 *
 * POR QUÉ ESTO EXISTE: la búsqueda usa un filtro de Supabase que se arma como
 * texto, separando condiciones con comas y paréntesis. Si alguien escribiera
 * una coma o un paréntesis en el buscador, esos símbolos se leerían como parte
 * del filtro y no como lo que la persona quiso buscar. En el mejor caso la
 * búsqueda se rompe; en el peor, alguien lo usa para pedir datos que no debería
 * poder ver.
 *
 * La solución es sacar esos símbolos antes de armar el filtro.
 */
export function limpiarBusqueda(entrada: string | undefined): string {
  if (!entrada) return "";
  return entrada
    .replace(/[,()*\\"']/g, " ") // símbolos que el filtro interpreta
    .replace(/%/g, " ")          // comodín de "cualquier cosa"
    .trim()
    .slice(0, 60);               // nadie busca frases de 500 letras
}
