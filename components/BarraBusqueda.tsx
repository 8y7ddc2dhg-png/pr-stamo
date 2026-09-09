import Link from "next/link";
import { CATEGORIAS } from "@/lib/categorias";
import { CIUDADES } from "@/lib/ciudades";

/**
 * Buscador y filtros.
 *
 * El texto y la ciudad van en un formulario que manda por GET; las categorías
 * son enlaces. Las dos formas dejan la búsqueda escrita en la dirección, así
 * que se puede compartir por WhatsApp, guardar en favoritos, y el botón de
 * atrás del teléfono funciona como la gente espera. Y nada de esto necesita
 * JavaScript, así que responde al instante en un celular lento.
 *
 * Las categorías son pastillas y no un menú desplegable porque en un catálogo
 * chico conviene VER las opciones: un menú esconde justamente lo que uno
 * quiere que la gente descubra.
 */
export default function BarraBusqueda({
  texto, categoria, ciudad,
}: {
  texto: string; categoria: string; ciudad: string;
}) {
  // Cada pastilla conserva lo demás que ya estaba filtrado.
  function enlaceDeCategoria(valor: string) {
    const parametros = new URLSearchParams();
    if (texto) parametros.set("q", texto);
    if (ciudad) parametros.set("ciudad", ciudad);
    if (valor) parametros.set("categoria", valor);
    const cadena = parametros.toString();
    return cadena ? `/?${cadena}` : "/";
  }

  const pastilla =
    "shrink-0 rounded-full border-[0.5px] px-3.5 py-1.5 text-[13px] font-medium transition-colors";

  return (
    <div>
      <form method="get" action="/" className="flex flex-col gap-2 sm:flex-row">
        {/* Los filtros de categoría viven en la dirección, no en este
            formulario. Sin este campo escondido, buscar por texto borraría la
            categoría que la persona ya había elegido. */}
        {categoria && <input type="hidden" name="categoria" value={categoria} />}

        <input
          name="q"
          defaultValue={texto}
          placeholder="Buscá un taladro, sillas, una carpa…"
          aria-label="Buscar"
          className="min-w-0 flex-1 rounded-xl border-[0.5px] border-tinta-300 bg-white px-4 py-3
                     text-base outline-none placeholder:text-tinta-400
                     focus:border-marca-600"
        />

        <div className="flex gap-2">
          <select
            name="ciudad"
            defaultValue={ciudad}
            aria-label="Ciudad"
            className="min-w-0 flex-1 rounded-xl border-[0.5px] border-tinta-300 bg-white px-3 py-3
                       text-base outline-none focus:border-marca-600 sm:w-44 sm:flex-none"
          >
            <option value="">Toda ciudad</option>
            {CIUDADES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <button
            type="submit"
            className="shrink-0 rounded-xl bg-marca-800 px-6 py-3 font-medium text-white
                       transition-colors hover:bg-marca-900"
          >
            Buscar
          </button>
        </div>
      </form>

      {/* En celular las pastillas se deslizan de lado en vez de amontonarse en
          cuatro filas. -mx-4 px-4 hace que el deslizamiento llegue hasta el
          borde de la pantalla y no se corte con un margen. */}
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link
          href={enlaceDeCategoria("")}
          className={`${pastilla} ${
            categoria === ""
              ? "border-transparent bg-tinta-900 text-white"
              : "border-tinta-300 bg-white text-tinta-700 hover:border-tinta-400"
          }`}
        >
          Todo
        </Link>

        {CATEGORIAS.map((c) => (
          <Link
            key={c.valor}
            href={enlaceDeCategoria(c.valor)}
            aria-current={categoria === c.valor ? "page" : undefined}
            className={`${pastilla} ${
              categoria === c.valor
                ? "border-transparent bg-tinta-900 text-white"
                : "border-tinta-300 bg-white text-tinta-700 hover:border-tinta-400"
            }`}
          >
            {c.etiqueta}
          </Link>
        ))}
      </div>
    </div>
  );
}
