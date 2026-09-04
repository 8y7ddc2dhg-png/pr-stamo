import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * La barra de arriba. Cambia según si hay sesión o no.
 *
 * Es un componente de servidor: lee quién está conectado antes de mandar el
 * HTML al navegador. Así no hay ese parpadeo de "Ingresar" que se convierte en
 * "Mi perfil" medio segundo después.
 */
export default async function Encabezado() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-slate-200">
      <nav className="mx-auto flex max-w-4xl items-center gap-4 px-5 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Prestamo
        </Link>

        <div className="ml-auto flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/publicar" className="font-medium hover:underline">
                Publicar
              </Link>
              <Link href="/mis-publicaciones" className="hover:underline">
                Mis publicaciones
              </Link>
              <Link href="/mis-reservas" className="hover:underline">
                Mis reservas
              </Link>
              <Link href="/mi-perfil" className="hover:underline">
                Mi perfil
              </Link>
              {/* Cerrar sesión va por POST: un GET podría dispararse solo
                  si alguien pone la dirección dentro de una imagen ajena. */}
              <form action="/auth/salir" method="post">
                <button type="submit" className="text-slate-500 hover:underline">
                  Salir
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/ingresar"
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
            >
              Ingresar
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
