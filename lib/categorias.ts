/**
 * Las categorías del catálogo.
 *
 * Viven aquí y no en una tabla de la base de datos porque una tabla implicaría
 * una pantalla para administrarla que nadie va a usar en el MVP. Agregar una
 * categoría es editar este archivo y escribir una migración de una línea que
 * actualice la restricción `listings_categoria_valida`.
 *
 * IMPORTANTE: esta lista tiene que coincidir exactamente con la restricción
 * CHECK de la migración 0001. Si se agrega aquí y no allá, la base de datos
 * va a rechazar la publicación.
 */

export const CATEGORIAS = [
  { valor: "herramientas",        etiqueta: "Herramientas" },
  { valor: "mobiliario_eventos",  etiqueta: "Mobiliario para eventos" },
  { valor: "equipo_audio_video",  etiqueta: "Equipo de audio y video" },
  { valor: "deportes_aire_libre", etiqueta: "Deportes y aire libre" },
  { valor: "hogar_jardin",        etiqueta: "Hogar y jardín" },
  { valor: "otros",               etiqueta: "Otros" },
] as const;

export type Categoria = (typeof CATEGORIAS)[number]["valor"];

const VALORES = CATEGORIAS.map((c) => c.valor) as readonly string[];

export function esCategoriaValida(valor: string): valor is Categoria {
  return VALORES.includes(valor);
}

export function etiquetaDeCategoria(valor: string): string {
  return CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? "Otros";
}
