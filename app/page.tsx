import { formatearQuetzales } from "@/lib/dinero";
import { contarDias, formatearRango } from "@/lib/fechas";
import { CATEGORIAS } from "@/lib/categorias";

/**
 * Portada provisional de la Fase 0.
 *
 * Todavía no hay catálogo ni base de datos conectada. Esta página existe para
 * comprobar dos cosas: que el despliegue funciona, y que las reglas de dinero
 * y de fechas dan los resultados correctos —incluida la de días inclusivos,
 * que es la fuente de error número uno en sistemas de reservas.
 *
 * Se reemplaza por el buscador real en la Fase 1.
 */
export default function Portada() {
  const inicio = "2026-10-15";
  const fin = "2026-10-17";
  const dias = contarDias(inicio, fin);
  const precioPorDia = 40000; // Q400.00 en centavos

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Prestamo</h1>
      <p className="mt-2 text-lg text-slate-600">
        Rentá lo que necesitás, por los días que lo necesitás.
      </p>

      <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Sitio en construcción. Fase 0 de 5: la base técnica ya está montada.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Comprobación de las reglas del proyecto
        </h2>

        <dl className="mt-4 divide-y divide-slate-200 border-y border-slate-200 text-sm">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-600">Precio por día</dt>
            <dd className="font-medium">{formatearQuetzales(precioPorDia)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-600">Fechas</dt>
            <dd className="font-medium text-right">
              {formatearRango(inicio, fin)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-600">
              Días <span className="text-slate-400">(rango inclusivo)</span>
            </dt>
            <dd className="font-medium">{dias}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-600">Total</dt>
            <dd className="font-semibold">
              {formatearQuetzales(precioPorDia * dias)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-slate-500">
          Del 15 al 17 son 3 días, no 2. Si acá dijera 2, habría un error en{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">lib/fechas.ts</code>.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Categorías del catálogo
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {CATEGORIAS.map((categoria) => (
            <li
              key={categoria.valor}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
            >
              {categoria.etiqueta}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
