/**
 * Conexión a Supabase desde el SERVIDOR.
 *
 * Hay dos clientes distintos aquí y la diferencia importa mucho:
 *
 *  - crearClienteServidor(): actúa EN NOMBRE del usuario que está navegando.
 *    Respeta las reglas de RLS. Es el que se usa el 95% del tiempo.
 *
 *  - crearClienteAdmin(): se salta TODAS las reglas de RLS. Solo para el
 *    webhook de pagos y el panel de administración, donde no hay un usuario
 *    con sesión de por medio. Nunca debe llegar al navegador.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { leerVariable } from "@/lib/entorno";

export async function crearClienteServidor() {
  const almacenCookies = await cookies();

  return createServerClient(
    leerVariable("NEXT_PUBLIC_SUPABASE_URL"),
    leerVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll();
        },
        setAll(cookiesNuevas) {
          try {
            for (const { name, value, options } of cookiesNuevas) {
              almacenCookies.set(name, value, options);
            }
          } catch {
            // Desde un Server Component no se pueden escribir cookies.
            // No es un error: el middleware ya se encarga de refrescar la
            // sesión en cada petición. Ignorarlo aquí es el patrón oficial.
          }
        },
      },
    }
  );
}

/**
 * Cliente con permisos totales. Úsese con miedo.
 *
 * Si esta llave llegara al navegador, cualquiera podría leer y borrar toda la
 * base de datos. El "throw" de abajo hace ruido temprano si alguien importa
 * este archivo por accidente desde un componente de cliente.
 */
export function crearClienteAdmin() {
  const llave = leerVariable("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(leerVariable("NEXT_PUBLIC_SUPABASE_URL"), llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
