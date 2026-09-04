import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearQuetzales } from "@/lib/dinero";

export const metadata = { title: "Mis publicaciones — Prestamo" };

export default async function MisPublicaciones() {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?volver_a=/mis-publicaciones");

  // RLS ya limita esto a las propias, pero el filtro explícito deja la
  // intención escrita en el código y no solo aplicada en la base de datos.
  const { data } = await supabase
    .from("listings")
    .select("id, titulo, precio_por_dia_centavos, ciudad, activo, listing_photos(url, orden)")
    .eq("user_id", user.id)
    .order("creado_en", { ascending: false });

  const publicaciones = data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Mis publicaciones</h1>
        <Link href="/publicar" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Publicar
        </Link>
      </div>

      {publicaciones.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
          <p className="font-medium">Todavía no publicaste nada.</p>
          <p className="mt-1 text-slate-600">
            Publicá algo que tengas guardado y que otra gente pueda necesitar por unos días.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
          {publicaciones.map((p) => {
            const portada = [...(p.listing_photos ?? [])].sort((a, b) => a.orden - b.orden)[0];
            return (
              <li key={p.id}>
                <Link href={`/item/${p.id}`} className="flex items-center gap-4 py-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {portada && (
                      <Image src={portada.url} alt="" fill className="object-cover" sizes="64px" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.titulo}</p>
                    <p className="text-sm text-slate-500">
                      {formatearQuetzales(p.precio_por_dia_centavos)} / día · {p.ciudad}
                    </p>
                  </div>
                  {!p.activo && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      Despublicado
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
