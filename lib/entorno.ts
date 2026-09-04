/**
 * Lectura de variables de entorno con errores entendibles.
 *
 * ⚠️ POR QUÉ SE PASA EL VALOR Y NO SOLO EL NOMBRE
 *
 * En el navegador NO existe `process`. Next.js reemplaza al compilar cada
 * `process.env.NEXT_PUBLIC_ALGO` por su valor literal —pero solo cuando está
 * escrito así, de forma directa y visible en el código.
 *
 * Si se escribe `process.env[nombre]`, con el nombre guardado en una variable,
 * el compilador no puede saber qué buscar y no reemplaza nada. En el servidor
 * funciona igual (ahí sí hay un `process` de verdad), pero en el navegador
 * falla SIEMPRE, aunque la variable esté perfectamente configurada.
 *
 * Por eso esta función recibe el valor ya leído. Queda más largo al llamarla,
 * y es a propósito: es la única forma de que funcione en los dos lados.
 *
 *   ✅ exigirVariable("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
 *   ❌ leerVariable("NEXT_PUBLIC_SUPABASE_URL")   ← se rompe en el navegador
 */

export function exigirVariable(nombre: string, valor: string | undefined): string {
  if (!valor || valor.includes("xxxxxxxx")) {
    throw new Error(
      `Falta la variable ${nombre}.\n\n` +
        `Si estás en tu computadora: abrí el archivo .env.local en la raíz del ` +
        `proyecto y llenala. La plantilla con todas las variables está en ` +
        `.env.example.\n\n` +
        `Si esto pasó en el sitio publicado: cargala en Vercel, en ` +
        `Settings → Environment Variables, y volvé a desplegar. Las variables ` +
        `que empiezan con NEXT_PUBLIC_ se incrustan al compilar, así que ` +
        `agregarlas no basta: hay que desplegar de nuevo después.`
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
  return (process.env.NEXT_PUBLIC_URL_SITIO ?? "http://localhost:3000").replace(/\/$/, "");
}
