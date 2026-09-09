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
    .select("id, titulo, categoria, precio_por_dia_centavos, ciudad, cantidad_disponible, listing_photos(url, orden)")
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
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-[26px] font-semibold leading-tight sm:text-4xl">
        Rentá lo que necesitás,
        <br className="hidden sm:block" /> por los días que lo necesitás
      </h1>
      <p className="mt-2 max-w-lg text-tinta-600">
        Herramientas, mobiliario y equipo que otra gente tiene guardado.
      </p>

      <div className="mt-6">
        <BarraBusqueda texto={texto} categoria={categoria} ciudad={ciudad} />
      </div>

      {error ? (
        <p className="mt-10 rounded-xl border-[0.5px] border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          No pudimos cargar el catálogo en este momento. Probá recargar la página.
        </p>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-xl border-[0.5px] border-dashed border-tinta-300 bg-white px-6 py-14 text-center">
          {hayFiltros ? (
            <>
              <p className="font-medium">No encontramos nada con esa búsqueda.</p>
              <p className="mt-1 text-tinta-600">Probá con otra palabra o quitá algún filtro.</p>
              <Link
                href="/"
                className="mt-5 inline-block rounded-full border-[0.5px] border-tinta-300 bg-white px-5 py-2.5 text-sm font-medium hover:border-tinta-400"
              >
                Ver todo el catálogo
              </Link>
            </>
          ) : (
            <>
              <p className="font-medium">Todavía no hay nada publicado.</p>
              <p className="mt-1 text-tinta-600">Sé el primero en publicar algo para rentar.</p>
              <Link
                href="/publicar"
                className="mt-5 inline-block rounded-full bg-marca-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-marca-900"
              >
                Publicar algo
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mt-7 text-sm text-tinta-500">
            {items.length === 1 ? "1 resultado" : `${items.length} resultados`}
          </p>

          {/* auto-fit con minmax deja que la grilla decida cuántas columnas
              caben: no hay que enumerar un tamaño de pantalla por cada corte,
              y se adapta también a anchos raros como una ventana a medio
              maximizar.

              El mínimo baja a 155px en celular a propósito: en una pantalla de
              375px quedan 343px útiles, y dos columnas de 180 necesitan 372.
              Con 180 fijo, un teléfono mostraría UNA sola tarjeta por fila y
              habría que barrer media pantalla por ítem. De tablet en adelante
              vuelve a 180. */}
          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(155px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] sm:gap-4">
            {items.map((item) => <TarjetaItem key={item.id} item={item} />)}
          </div>
        </>
      )}
    </main>
  );
}
