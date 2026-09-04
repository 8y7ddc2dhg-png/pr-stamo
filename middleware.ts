/**
 * El middleware corre ANTES de cada página, en el servidor.
 *
 * Hace dos cosas:
 *
 *  1. Refresca la sesión. Las sesiones de Supabase vencen cada hora y se
 *     renuevan solas, pero alguien tiene que pedir la renovación. Sin esto,
 *     al usuario se le cerraría la sesión sola mientras navega.
 *
 *  2. Bloquea las páginas privadas. Si alguien sin sesión escribe /publicar
 *     en la barra de direcciones, lo manda a ingresar y se acuerda de a dónde
 *     quería ir, para llevarlo ahí después de que entre.
 *
 * OJO: esto NO reemplaza la verificación de permisos en cada Route Handler.
 * El middleware decide si mostrar una pantalla; los permisos de verdad se
 * verifican otra vez antes de tocar la base de datos (ver CLAUDE.md, regla 6).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Páginas que exigen sesión iniciada.
const RUTAS_PRIVADAS = ["/publicar", "/mis-publicaciones", "/mi-perfil", "/mis-reservas", "/reserva"];

export async function middleware(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesNuevas) {
          for (const { name, value } of cookiesNuevas) {
            request.cookies.set(name, value);
          }
          respuesta = NextResponse.next({ request });
          for (const { name, value, options } of cookiesNuevas) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() habla con Supabase y verifica el token de verdad.
  // No usar getSession() acá: ese solo lee la cookie, y una cookie se puede
  // falsificar. Para decidir permisos hay que preguntarle al servidor.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esPrivada = RUTAS_PRIVADAS.some(
    (r) => ruta === r || ruta.startsWith(`${r}/`)
  );

  if (esPrivada && !user) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/ingresar";
    // Guardamos a dónde quería ir para devolverlo ahí después de ingresar.
    destino.searchParams.set("volver_a", ruta);
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  // Se salta archivos estáticos e imágenes: correr esto en cada ícono sería
  // desperdiciar tiempo en cada carga de página.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
