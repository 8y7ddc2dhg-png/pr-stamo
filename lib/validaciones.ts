/**
 * Validaciones de formularios.
 *
 * Todas devuelven `null` cuando el dato está bien, o el mensaje de error listo
 * para mostrar. Los mensajes se escriben para una persona, no para un
 * programador (ver CLAUDE.md).
 *
 * IMPORTANTE: estas validaciones también corren en el servidor. Validar solo
 * en el navegador no protege nada: cualquiera puede mandar datos directo al
 * servidor saltándose la pantalla.
 */

/**
 * Los números de Guatemala tienen 8 dígitos. Acepta que la gente los escriba
 * como quiera —con guiones, espacios, o con el +502 adelante— y los guarda
 * siempre igual, para que después se puedan comparar y armar enlaces de
 * WhatsApp sin sorpresas.
 */
export function normalizarTelefono(entrada: string): string | null {
  const digitos = entrada.replace(/\D/g, "");
  const sinCodigoPais =
    digitos.length === 11 && digitos.startsWith("502") ? digitos.slice(3) : digitos;

  // En Guatemala los números empiezan entre 2 y 7. Un 0 o un 1 al inicio es
  // siempre un error de dedo.
  if (!/^[2-7]\d{7}$/.test(sinCodigoPais)) return null;
  return sinCodigoPais;
}

/** 55123456 → "5512-3456" */
export function formatearTelefono(ocho: string): string {
  return `${ocho.slice(0, 4)}-${ocho.slice(4)}`;
}

export function validarNombre(nombre: string): string | null {
  const limpio = nombre.trim();
  if (limpio.length < 2) return "Escribí tu nombre o el de tu negocio.";
  if (limpio.length > 80) return "El nombre es demasiado largo (máximo 80 letras).";
  return null;
}

export function validarTelefono(telefono: string): string | null {
  if (!telefono.trim()) return "Necesitamos tu número de WhatsApp para coordinar las entregas.";
  if (!normalizarTelefono(telefono))
    return "Ese número no parece de Guatemala. Son 8 dígitos, por ejemplo 5512-3456.";
  return null;
}
