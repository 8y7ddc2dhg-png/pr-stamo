import Link from "next/link";
import Image from "next/image";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * La barra de arriba: logo, "Publicar" y el avatar de quien está conectado.
 *
 * Es un componente de servidor: lee la sesión antes de mandar el HTML, así no
 * hay ese parpadeo de "Ingresar" que se convierte en avatar medio segundo
 * después.
 *
 * En celular el menú del avatar no despliega nada: el avatar ES el enlace al
 * perfil, y desde ahí se llega al resto. Un menú desplegable en una barra de
 * 375px es más estorbo que ayuda.
 */
export default async function Encabezado() {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = user
    ? await supabase.from("users").select("nombre, foto_url").eq("id", user.id).single()
    : { data: null };

  // Las iniciales son el respaldo cuando no hay foto. Sin esto, el avatar
  // sería un círculo gris idéntico para todos.
  const iniciales = (perfil?.nombre ?? user?.email ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra: string) => palabra[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="sticky top-0 z-20 border-b border-tinta-200/80 bg-tinta-50/90 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-xl bg-marca-800 text-sm font-bold text-white"
          >
            P
          </span>
          <span className="text-[17px] font-semibold tracking-tight">Prestamo</span>
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link
                href="/publicar"
                className="rounded-full bg-marca-800 px-4 py-2 text-sm font-medium text-white
                           transition-colors hover:bg-marca-900"
              >
                Publicar
              </Link>

              <Link
                href="/mi-perfil"
                aria-label="Mi perfil"
                title={perfil?.nombre ?? "Mi perfil"}
                className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden
                           rounded-full border border-tinta-200 bg-tinta-100 text-xs font-semibold
                           text-tinta-600 transition-colors hover:border-tinta-400"
              >
                {perfil?.foto_url ? (
                  <Image src={perfil.foto_url} alt="" fill className="object-cover" sizes="36px" />
                ) : (
                  iniciales
                )}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/publicar"
                className="hidden text-sm font-medium text-tinta-700 hover:text-tinta-900 sm:block"
              >
                Publicar
              </Link>
              <Link
                href="/ingresar"
                className="rounded-full bg-marca-800 px-4 py-2 text-sm font-medium text-white
                           transition-colors hover:bg-marca-900"
              >
                Ingresar
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
