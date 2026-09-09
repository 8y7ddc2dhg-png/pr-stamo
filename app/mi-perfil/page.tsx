import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioPerfil from "@/components/FormularioPerfil";
import type { Usuario } from "@/lib/tipos";

export const metadata = { title: "Mi perfil — Prestamo" };

export default async function PaginaMiPerfil() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El middleware ya bloquea esta ruta sin sesión. Esta segunda verificación
  // no sobra: es la que protege los datos si alguien cambia el middleware por
  // error algún día.
  if (!user) redirect("/ingresar?volver_a=/mi-perfil");

  const { data: perfil } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single<Usuario>();

  if (!perfil) {
    return (
      <main className="mx-auto max-w-xl px-5 py-12">
        <h1 className="text-2xl font-bold">Algo salió mal</h1>
        <p className="mt-2 text-tinta-600">
          No encontramos tu perfil. Cerrá sesión y volvé a entrar; si sigue
          pasando, escribinos.
        </p>
      </main>
    );
  }

  const estaIncompleto = !perfil.nombre || !perfil.telefono_whatsapp || !perfil.ciudad;

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>
      <p className="mt-2 text-tinta-600">
        Ingresaste como <strong className="break-all">{perfil.correo}</strong>.
      </p>

      {estaIncompleto && (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Completá estos datos para poder publicar algo o rentar. Es una sola vez.
        </p>
      )}

      <div className="mt-8">
        <FormularioPerfil perfil={perfil} />
      </div>

      {/* Cerrar sesión vive acá, al final del perfil, y no en la barra de
          arriba: es una acción que se busca a propósito, no algo que uno quiera
          tener a un dedo de distancia del botón de publicar.

          Va por POST y no por un enlace común porque un GET puede dispararse
          solo si alguien pone la dirección dentro de una imagen en otro sitio,
          y te cerraría la sesión sin que lo pidieras. */}
      <div className="mt-10 border-t border-tinta-200 pt-6">
        <h2 className="text-sm font-medium">Sesión</h2>
        <p className="mt-1 text-sm text-tinta-600">
          Estás dentro como <strong className="break-all">{perfil.correo}</strong>. Si cerrás
          sesión, para volver a entrar te mandamos otro enlace al correo.
        </p>
        <form action="/auth/salir" method="post" className="mt-3">
          <button
            type="submit"
            className="rounded-xl border-[0.5px] border-tinta-300 bg-white px-5 py-2.5 text-sm
                       font-medium transition-colors hover:border-red-300 hover:text-red-700"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
