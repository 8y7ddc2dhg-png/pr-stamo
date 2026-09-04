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
        <p className="mt-2 text-slate-600">
          No encontramos tu perfil. Cerrá sesión y volvé a entrar; si sigue
          pasando, escribinos.
        </p>
      </main>
    );
  }

  const estaIncompleto = !perfil.nombre || !perfil.telefono_whatsapp || !perfil.ciudad;

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
      <p className="mt-2 text-slate-600">
        Ingresaste como <strong className="break-all">{perfil.correo}</strong>.
      </p>

      {estaIncompleto && (
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Completá estos datos para poder publicar algo o rentar. Es una sola vez.
        </p>
      )}

      <div className="mt-8">
        <FormularioPerfil perfil={perfil} />
      </div>
    </main>
  );
}
