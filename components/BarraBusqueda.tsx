import { CATEGORIAS } from "@/lib/categorias";
import { CIUDADES } from "@/lib/ciudades";

/**
 * El buscador. Es un formulario normal que manda por GET.
 *
 * ¿Por qué GET y no algo interactivo? Porque así la búsqueda queda en la
 * dirección: se puede compartir por WhatsApp, guardar en favoritos, y el botón
 * de "atrás" del teléfono funciona como la gente espera. Y no necesita nada de
 * JavaScript, así que carga al instante en un celular lento.
 */
export default function BarraBusqueda({
  texto, categoria, ciudad,
}: {
  texto: string; categoria: string; ciudad: string;
}) {
  const claseCampo =
    "w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none " +
    "focus:border-slate-900 focus:ring-1 focus:ring-slate-900";

  return (
    <form method="get" action="/" className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
      <input
        name="q" defaultValue={texto} placeholder="Buscá un taladro, sillas, una carpa…"
        aria-label="Buscar" className={claseCampo}
      />
      <select name="categoria" defaultValue={categoria} aria-label="Categoría" className={claseCampo}>
        <option value="">Toda categoría</option>
        {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
      </select>
      <select name="ciudad" defaultValue={ciudad} aria-label="Ciudad" className={claseCampo}>
        <option value="">Toda ciudad</option>
        {CIUDADES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button type="submit" className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white">
        Buscar
      </button>
    </form>
  );
}
