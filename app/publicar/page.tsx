import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioPublicar from "@/components/FormularioPublicar";

export const metadata = { title: "Publicar un ítem — Prestamo" };

export default async function PaginaPublicar() {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?volver_a=/publicar");

  const { data: perfil } = await supabase
    .from("users").select("nombre, telefono_whatsapp, ciudad").eq("id", user.id).single();

  // Se manda al perfil antes de dejarlo llenar todo un formulario para después
  // rebotarlo. Es la diferencia entre avisar antes y frustrar después.
  if (!perfil?.nombre || !perfil?.telefono_whatsapp) redirect("/mi-perfil");

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Publicar algo para rentar</h1>
      <p className="mt-2 text-slate-600">
        Contá qué tenés, poné un precio por día y subí al menos una foto.
      </p>
      <div className="mt-8">
        <FormularioPublicar usuarioId={user.id} ciudadDelPerfil={perfil?.ciudad ?? null} />
      </div>
    </main>
  );
}
