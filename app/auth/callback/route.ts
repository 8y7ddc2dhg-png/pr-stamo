/**
 * Acá aterriza el usuario cuando toca el enlace mágico de su correo.
 *
 * El enlace trae un código de un solo uso. Este código se cambia por una
 * sesión real, que queda guardada en una cookie. Después se lo manda a donde
 * quería ir.
 *
 * Es un Route Handler (código de servidor), no una página: no dibuja nada,
 * solo procesa y redirige.
 */
import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function GET(peticion: Request) {
  const { searchParams, origin } = new URL(peticion.url);
  const codigo = searchParams.get("code");
  const volverA = searchParams.get("volver_a") ?? "/mi-perfil";

  if (codigo) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);

    if (!error) {
      // Solo se aceptan rutas internas. Si alguien manipulara el enlace para
      // poner una dirección de otro sitio, lo estaríamos ayudando a hacer
      // parecer que ese sitio es nuestro. Exigir que empiece con "/" lo evita.
      const destino = volverA.startsWith("/") ? volverA : "/mi-perfil";
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  return NextResponse.redirect(`${origin}/ingresar?error=enlace_vencido`);
}
