/**
 * Conexión a Supabase desde el NAVEGADOR.
 *
 * Usa la llave "anónima", que es pública y viaja dentro del código que se
 * descarga al teléfono del usuario. Eso es seguro ÚNICAMENTE porque tenemos
 * RLS activado en todas las tablas: la llave permite pedir datos, pero las
 * reglas de la base de datos deciden cuáles se entregan.
 *
 * Por eso RLS no es opcional en este proyecto.
 */
import { createBrowserClient } from "@supabase/ssr";

export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
