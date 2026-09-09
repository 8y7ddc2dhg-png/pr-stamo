import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import Checkout from "@/components/Checkout";
import { formatearTelefono } from "@/lib/validaciones";

export const metadata = { title: "Confirmar pedido — Prestamo" };

export default async function PaginaCheckout() {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?volver_a=/checkout");

  const { data: perfil } = await supabase
    .from("users").select("nombre, telefono_whatsapp, ciudad, correo").eq("id", user.id).single();

  // El nombre del perfil es uno solo; acá se piden nombre y apellido por
  // separado. Se parte por el primer espacio, que acierta en la mayoría de los
  // casos, y la persona puede corregirlo.
  const partes = (perfil?.nombre ?? "").trim().split(/\s+/);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold">Confirmar pedido</h1>
      <div className="mt-6">
        <Checkout
          datosIniciales={{
            nombre: partes[0] ?? "",
            apellido: partes.slice(1).join(" "),
            correo: perfil?.correo ?? user.email ?? "",
            telefono: perfil?.telefono_whatsapp ? formatearTelefono(perfil.telefono_whatsapp) : "",
            ciudad: perfil?.ciudad ?? "",
          }}
        />
      </div>
    </main>
  );
}
