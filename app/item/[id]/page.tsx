import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearQuetzales } from "@/lib/dinero";
import { etiquetaDeCategoria } from "@/lib/categorias";
import type { PerfilPublico } from "@/lib/tipos";

type ItemCompleto = {
  id: string;
  user_id: string;
  titulo: string;
  categoria: string;
  descripcion: string;
  precio_por_dia_centavos: number;
  ciudad: string;
  cantidad_disponible: number;
  activo: boolean;
  listing_photos: { url: string; orden: number }[];
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("listings").select("titulo").eq("id", id).single();
  return { title: data?.titulo ? `${data.titulo} — Prestamo` : "Ítem — Prestamo" };
}

export default async function FichaItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("listings")
    .select("id, user_id, titulo, categoria, descripcion, precio_por_dia_centavos, ciudad, cantidad_disponible, activo, listing_photos(url, orden)")
    .eq("id", id)
    .single();

  // Si no existe, o está despublicado y no es del usuario, RLS no lo devuelve
  // y llegamos acá con null. La pantalla de "no encontrado" es la respuesta
  // correcta en los dos casos.
  if (!data) notFound();
  const item = data as ItemCompleto;

  // Se consulta el perfil por separado, contra la vista perfiles_publicos, que
  // solo expone nombre, ciudad y foto. Así no hay forma de que se filtre el
  // teléfono o el correo del publicador a esta pantalla.
  const { data: publicador } = await supabase
    .from("perfiles_publicos")
    .select("id, nombre, ciudad, foto_url")
    .eq("id", item.user_id)
    .single<PerfilPublico>();

  const fotos = [...item.listing_photos].sort((a, b) => a.orden - b.orden);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Volver al catálogo
      </Link>

      {!item.activo && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta publicación está despublicada. Solo vos podés verla.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {fotos.map((foto, indice) => (
          <div
            key={foto.url}
            className={`relative overflow-hidden rounded-xl bg-slate-100 ${
              indice === 0 ? "aspect-[4/3] sm:col-span-2" : "aspect-square"
            }`}
          >
            <Image
              src={foto.url}
              alt={`${item.titulo} — foto ${indice + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 700px"
              priority={indice === 0}
            />
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-slate-500">{etiquetaDeCategoria(item.categoria)}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{item.titulo}</h1>

      <p className="mt-3 text-2xl font-semibold">
        {formatearQuetzales(item.precio_por_dia_centavos)}
        <span className="text-base font-normal text-slate-500"> por día</span>
      </p>

      <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200 text-sm">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-slate-600">Se entrega en</dt>
          <dd className="font-medium">{item.ciudad}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-slate-600">Unidades disponibles</dt>
          <dd className="font-medium">{item.cantidad_disponible}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-slate-600">Publicado por</dt>
          <dd className="font-medium">
            {publicador?.nombre ?? "Alguien"}
            {publicador?.ciudad && (
              <span className="font-normal text-slate-500"> · {publicador.ciudad}</span>
            )}
          </dd>
        </div>
      </dl>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Descripción
      </h2>
      {/* whitespace-pre-line respeta los saltos de línea que escribió la
          persona, sin dejar que meta HTML: React escapa el texto solo. */}
      <p className="mt-2 whitespace-pre-line leading-relaxed">{item.descripcion}</p>

      <div className="mt-10 rounded-xl border border-slate-200 p-5">
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-lg bg-slate-200 px-4 py-3 font-medium text-slate-500"
        >
          Solicitar reserva
        </button>
        <p className="mt-2 text-center text-sm text-slate-500">
          Las reservas y el pago en línea todavía no están habilitados.
        </p>
      </div>
    </main>
  );
}
