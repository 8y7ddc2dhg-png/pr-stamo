import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearQuetzales } from "@/lib/dinero";
import { etiquetaDeCategoria } from "@/lib/categorias";
import type { PerfilPublico } from "@/lib/tipos";
import SelectorFechas from "@/components/SelectorFechas";
import { diasSinCupo } from "@/lib/disponibilidad";
import { hoyEnGuatemala } from "@/lib/fechas";

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

  // Quién está mirando, para decidir si puede reservar.
  const { data: { user } } = await supabase.auth.getUser();

  // Los días ya comprometidos, para pintarlos como no disponibles. Se miran
  // 90 días hacia adelante: más allá de eso nadie reserva un taladro.
  const hoy = hoyEnGuatemala();
  const { data: ocupadas } = await supabase
    .from("reservations")
    .select("inicio_en, fin_en")
    .eq("listing_id", item.id)
    .in("estado", ["solicitada", "aceptada", "pagada", "entregada"])
    .gte("fin_en", hoy);

  const diasOcupados = diasSinCupo(hoy, 90, item.cantidad_disponible, ocupadas ?? []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-tinta-500 hover:text-tinta-900"
      >
        ← Volver al catálogo
      </Link>

      {!item.activo && (
        <p className="mt-4 rounded-xl border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta publicación está despublicada. Solo vos podés verla.
        </p>
      )}

      {/* En escritorio la información va a la izquierda y el panel de reserva
          queda pegado a la derecha mientras se desplaza la página: así el
          precio y el botón nunca se pierden de vista. En celular todo se apila
          y el panel cae al final, que es el orden natural de lectura. */}
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {fotos.map((foto, indice) => (
              <div
                key={foto.url}
                className={`relative overflow-hidden rounded-xl border-[0.5px] border-tinta-200 bg-tinta-100 ${
                  indice === 0 ? "aspect-[4/3] sm:col-span-2" : "aspect-square"
                }`}
              >
                <Image
                  src={foto.url}
                  alt={`${item.titulo} — foto ${indice + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 600px"
                  priority={indice === 0}
                />
              </div>
            ))}
          </div>

          <span className="mt-5 inline-block rounded-full bg-marca-50 px-3 py-1 text-xs font-medium text-marca-800">
            {etiquetaDeCategoria(item.categoria)}
          </span>

          <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
            {item.titulo}
          </h1>

          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border-[0.5px] border-tinta-200 bg-tinta-200 text-sm">
            <div className="bg-white px-4 py-3">
              <dt className="text-xs text-tinta-500">Se entrega en</dt>
              <dd className="mt-0.5 font-medium">{item.ciudad}</dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-xs text-tinta-500">Unidades</dt>
              <dd className="mt-0.5 font-medium">{item.cantidad_disponible}</dd>
            </div>
            <div className="col-span-2 bg-white px-4 py-3">
              <dt className="text-xs text-tinta-500">Publicado por</dt>
              <dd className="mt-0.5 font-medium">
                {publicador?.nombre ?? "Alguien"}
                {publicador?.ciudad && (
                  <span className="font-normal text-tinta-500"> · {publicador.ciudad}</span>
                )}
              </dd>
            </div>
          </dl>

          <h2 className="mt-7 text-xs font-semibold uppercase tracking-wider text-tinta-500">
            Descripción
          </h2>
          {/* whitespace-pre-line respeta los saltos de línea que escribió la
              persona, sin dejar que meta HTML: React escapa el texto solo. */}
          <p className="mt-2 whitespace-pre-line leading-relaxed text-tinta-800">
            {item.descripcion}
          </p>
        </div>

        <div className="lg:sticky lg:top-20">
          <div className="mb-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold">
              {formatearQuetzales(item.precio_por_dia_centavos)}
            </span>
            <span className="text-sm text-tinta-500">por día</span>
          </div>

          <SelectorFechas
            listingId={item.id}
            titulo={item.titulo}
            fotoUrl={fotos[0]?.url ?? null}
            ciudad={item.ciudad}
            publicadorId={item.user_id}
            publicadorNombre={publicador?.nombre ?? "Alguien"}
            precioPorDiaCentavos={item.precio_por_dia_centavos}
            diasOcupados={diasOcupados}
            haySesion={Boolean(user)}
            esMio={user?.id === item.user_id}
          />
        </div>
      </div>
    </main>
  );
}
