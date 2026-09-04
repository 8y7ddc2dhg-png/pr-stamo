import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import BarraBusqueda from "@/components/BarraBusqueda";
import TarjetaItem, { type ItemDeCatalogo } from "@/components/TarjetaItem";
import { limpiarBusqueda } from "@/lib/busqueda";
import { esCategoriaValida } from "@/lib/categorias";
import { esCiudadValida } from "@/lib/ciudades";

export const metadata = {
  title: "Prestamo — Rentá lo que necesitás, por los días que lo necesitás",
};

export default async function Portada({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; ciudad?: string }>;
}) {
  const parametros = await searchParams;

  const texto = limpiarBusqueda(parametros.q);
  const categoria = esCategoriaValida(parametros.categoria ?? "") ? parametros.categoria! : "";
  const ciudad = esCiudadValida(parametros.ciudad ?? "") ? parametros.ciudad! : "";

  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("listings")
    .select("id, titulo, categoria, precio_por_dia_centavos, ciudad, listing_photos(url, orden)")
    .eq("activo", true)
    .order("creado_en", { ascending: false })
    .limit(60);

  // ILIKE busca sin distinguir mayúsculas. Es simple y con menos de mil ítems
  // es instantáneo. Limitación conocida: buscar "taladros" no encuentra
  // "taladro". Se cambia por búsqueda de texto completo cuando el catálogo
  // crezca; hoy no vale la pena.
  if (texto) consulta = consulta.or(`titulo.ilike.%${texto}%,descripcion.ilike.%${texto}%`);
  if (categoria) consulta = consulta.eq("categoria", categoria);
  if (ciudad) consulta = consulta.eq("ciudad", ciudad);

  const { data, error } = await consulta;
  const items = (data ?? []) as ItemDeCatalogo[];
  const hayFiltros = Boolean(texto || categoria || ciudad);

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Rentá lo que necesitás, por los días que lo necesitás
      </h1>
      <p className="mt-2 text-slate-600">
        Herramientas, mobiliario y equipo que otra gente tiene guardado.
      </p>

      <div className="mt-6">
        <BarraBusqueda texto={texto} categoria={categoria} ciudad={ciudad} />
      </div>

      {error ? (
        <p className="mt-10 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          No pudimos cargar el catálogo en este momento. Probá recargar la página.
        </p>
      ) : items.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
          {hayFiltros ? (
            <>
              <p className="font-medium">No encontramos nada con esa búsqueda.</p>
              <p className="mt-1 text-slate-600">Probá con otra palabra o quitá algún filtro.</p>
              <Link href="/" className="mt-4 inline-block font-medium underline">
                Ver todo el catálogo
              </Link>
            </>
          ) : (
            <>
              <p className="font-medium">Todavía no hay nada publicado.</p>
              <p className="mt-1 text-slate-600">Sé el primero en publicar algo para rentar.</p>
              <Link
                href="/publicar"
                className="mt-4 inline-block rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white"
              >
                Publicar algo
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm text-slate-500">
            {items.length === 1 ? "1 resultado" : `${items.length} resultados`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => <TarjetaItem key={item.id} item={item} />)}
          </div>
        </>
      )}
    </main>
  );
}
