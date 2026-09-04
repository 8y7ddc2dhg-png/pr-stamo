/**
 * Achicar fotos antes de subirlas.
 *
 * Una foto de celular moderno pesa entre 3 y 8 MB. Diez ítems con 3 fotos cada
 * uno serían más de 100 MB: el catálogo tardaría una eternidad en cargar en una
 * conexión móvil guatemalteca, y se comería el plan gratuito de Supabase en
 * pocas semanas.
 *
 * Achicando a 1600px de ancho, una foto queda en unos 200-400 KB. A simple
 * vista en un teléfono no se nota la diferencia.
 *
 * Esto corre en el NAVEGADOR, antes de subir. Así el archivo pesado nunca
 * viaja por la red.
 */

const ANCHO_MAXIMO = 1600;
const CALIDAD = 0.82;

export async function achicarImagen(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);

  // Si ya es chica, no la tocamos: volver a comprimir una foto solo la empeora.
  const escala = Math.min(1, ANCHO_MAXIMO / bitmap.width);
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("El navegador no pudo procesar la imagen.");
  contexto.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error("No se pudo achicar la imagen."))),
      "image/jpeg",
      CALIDAD
    );
  });
}

/** Revisa el archivo antes de tocarlo. Devuelve el error listo para mostrar. */
export function validarArchivoImagen(archivo: File): string | null {
  if (!archivo.type.startsWith("image/")) {
    return "Ese archivo no es una foto. Subí una imagen JPG o PNG.";
  }
  // 25 MB es más de lo que produce cualquier celular; si pesa más, algo raro hay.
  if (archivo.size > 25 * 1024 * 1024) {
    return "Esa foto pesa demasiado. Probá con una más liviana.";
  }
  return null;
}
