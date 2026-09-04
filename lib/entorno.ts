/**
 * Lectura de variables de entorno con errores entendibles.
 *
 * Sin esto, olvidarse de llenar una llave en .env.local produce un error como
 * "Cannot read properties of undefined", que no le dice nada a nadie y se
 * tarda media hora en rastrear. Con esto, dice exactamente qué falta y dónde
 * ponerlo.
 */

export function leerVariable(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor || valor.includes("xxxxxxxx")) {
    throw new Error(
      `Falta la variable ${nombre}.\n\n` +
        `Si estás en tu computadora: abrí el archivo .env.local en la raíz del ` +
        `proyecto y llenala. La plantilla con todas las variables está en ` +
        `.env.example.\n\n` +
        `Si esto pasó en el sitio publicado: cargala en Vercel, en ` +
        `Settings → Environment Variables, y volvé a desplegar.`
    );
  }

  return valor;
}

/** El porcentaje de comisión, leído una sola vez y validado. */
export function comisionPlataforma(): number {
  const crudo = process.env.COMISION_PLATAFORMA ?? "0.15";
  const numero = Number(crudo);

  if (!Number.isFinite(numero) || numero < 0 || numero > 1) {
    throw new Error(
      `COMISION_PLATAFORMA vale "${crudo}", que no sirve. Tiene que ser un ` +
        `decimal entre 0 y 1. Por ejemplo: 0.15 significa 15%.`
    );
  }

  return numero;
}

/** La dirección pública del sitio, sin barra al final. */
export function urlSitio(): string {
  return (process.env.NEXT_PUBLIC_URL_SITIO ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}
