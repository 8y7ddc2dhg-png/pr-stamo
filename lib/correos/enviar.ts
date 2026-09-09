import { Resend } from "resend";

/**
 * Envío de correos con Resend.
 *
 * DOS COSAS DISTINTAS QUE HACE RESEND EN ESTE PROYECTO, y conviene no
 * confundirlas:
 *
 *  1. EL CORREO DE INGRESO (el enlace mágico). Ese NO pasa por este archivo.
 *     Lo manda Supabase, y Resend actúa solo como el cartero. Se configura
 *     con clics en el panel de Supabase, sin escribir código. Es lo que
 *     levanta el límite de 2 o 3 correos por hora del servidor de fábrica.
 *
 *  2. LOS AVISOS DE LA APP ("tenés una reserva nueva", "te pagaron"). Esos sí
 *     los manda nuestro código, y para eso es este archivo.
 *
 * REGLA IMPORTANTE: un correo que falla NUNCA rompe la operación. Si Resend
 * está caído, la reserva igual se guarda. Por eso esta función no lanza
 * errores: devuelve si pudo o no, y quien la llama sigue adelante.
 *
 * RESEND_API_KEY no lleva el prefijo NEXT_PUBLIC_, así que Next.js la deja
 * únicamente en el servidor y nunca viaja al navegador. Es una llave secreta:
 * quien la tenga puede mandar correos a nombre de ustedes.
 */

export type Correo = {
  para: string;
  asunto: string;
  html: string;
  texto: string;
};

/**
 * ¿Está Resend configurado?
 *
 * Se escribe `process.env.RESEND_API_KEY` completo y a la vista a propósito.
 * Next.js reemplaza estas expresiones al compilar y no puede resolverlas si el
 * nombre va guardado en una variable — el mismo error que dejó el ingreso roto
 * en su momento. La documentación de Next lo dice explícitamente:
 * "dynamic lookups will not be inlined".
 */
function llaveDeResend(): string | null {
  const llave = process.env.RESEND_API_KEY;
  if (!llave || llave.includes("xxxxxxxx")) return null;
  return llave;
}

function remitente(): string {
  return process.env.CORREO_REMITENTE ?? "Prestamo <onboarding@resend.dev>";
}

export async function enviarCorreo(correo: Correo): Promise<boolean> {
  const llave = llaveDeResend();

  // Sin configurar, la app funciona igual: solo no manda avisos. Se deja
  // constancia en el registro del servidor para que no sea un misterio
  // silencioso cuando alguien pregunte "¿por qué no me llegó nada?".
  if (!llave) {
    console.warn(
      `[correos] RESEND_API_KEY sin configurar. No se envió "${correo.asunto}" a ${correo.para}.`
    );
    return false;
  }

  try {
    const resend = new Resend(llave);
    const { error } = await resend.emails.send({
      from: remitente(),
      to: correo.para,
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto, // para clientes de correo que no muestran HTML
    });

    if (error) {
      console.error(`[correos] Resend rechazó "${correo.asunto}": ${error.message}`);
      return false;
    }
    return true;
  } catch (fallo) {
    // Se atrapa TODO: una caída de red acá no puede tumbar una reserva.
    console.error(`[correos] Falló el envío de "${correo.asunto}":`, fallo);
    return false;
  }
}
