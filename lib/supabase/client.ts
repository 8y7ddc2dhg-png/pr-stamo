/**
 * Conexión a Supabase desde el NAVEGADOR.
 *
 * Usa la llave "anónima", que es pública y viaja dentro del código que se
 * descarga al teléfono del usuario. Eso es seguro ÚNICAMENTE porque tenemos
 * RLS activado en todas las tablas: la llave permite pedir datos, pero las
 * reglas de la base de datos deciden cuáles se entregan.
 *
 * Por eso RLS no es opcional en este proyecto.
 *
 * OJO con las dos líneas de abajo: `process.env.NEXT_PUBLIC_...` tiene que
 * quedar escrito TAL CUAL, completo y a la vista. Es lo que el compilador
 * busca para reemplazarlo por el valor. Ver la explicación en lib/entorno.ts.
 */
import { createBrowserClient } from "@supabase/ssr";
import { exigirVariable } from "@/lib/entorno";

export function crearClienteNavegador() {
  return createBrowserClient(
    exigirVariable("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    exigirVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
