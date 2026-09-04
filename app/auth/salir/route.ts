import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Cerrar sesión.
 *
 * Es POST y no GET a propósito: un GET puede dispararse solo si alguien mete
 * la dirección dentro de una etiqueta de imagen en otro sitio, y cerraría la
 * sesión del usuario sin que lo pidiera. Con POST eso no pasa.
 */
export async function POST(peticion: Request) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", peticion.url), { status: 303 });
}
