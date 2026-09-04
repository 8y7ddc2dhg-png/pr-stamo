"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { contarDias, formatearRango, hoyEnGuatemala, sumarDias, validarRango } from "@/lib/fechas";
import { formatearQuetzales } from "@/lib/dinero";

/**
 * Elegir fechas y reservar.
 *
 * Los días ya ocupados llegan calculados desde el servidor y se bloquean acá
 * para que la persona no llene el formulario y recién ahí se entere. Igual el
 * servidor vuelve a verificar la disponibilidad antes de guardar: entre que se
 * dibuja esta pantalla y se aprieta el botón, alguien más pudo haber reservado.
 */
export default function SelectorFechas({
  listingId,
  precioPorDiaCentavos,
  diasOcupados,
  haySesion,
  esMio,
}: {
  listingId: string;
  precioPorDiaCentavos: number;
  diasOcupados: string[];
  haySesion: boolean;
  esMio: boolean;
}) {
  const router = useRouter();
  const hoy = hoyEnGuatemala();

  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const ocupados = new Set(diasOcupados);

  // El total solo se muestra si las fechas son válidas y ningún día del rango
  // está ocupado. Mostrar un precio sobre fechas imposibles sería mentir.
  let dias = 0;
  let total = 0;
  let aviso: string | null = null;

  // Un campo de fecha deja su valor VACÍO hasta que la fecha esté completa y
  // sea válida. Alguien puede ver algo escrito en el campo y que el valor no
  // haya entrado. Por eso, cuando falta una fecha, se dice explícitamente en
  // vez de dejar un botón gris que no explica nada.
  if (!inicio || !fin) {
    aviso = "Elegí las dos fechas para ver el total.";
  } else {
    const problemaDeFechas = validarRango(inicio, fin);
    if (problemaDeFechas) {
      aviso = problemaDeFechas;
    } else {
      dias = contarDias(inicio, fin);
      total = precioPorDiaCentavos * dias;
      for (let i = 0; i < dias; i++) {
        if (ocupados.has(sumarDias(inicio, i))) {
          aviso = "Alguno de esos días ya está reservado. Probá con otras fechas.";
          dias = 0;
          break;
        }
      }
    }
  }

  const listoParaReservar = dias > 0 && !aviso;

  async function reservar() {
    setError(null);

    // El botón ya NO está deshabilitado cuando faltan datos: se puede apretar
    // y responde diciendo qué falta. Un control gris que no reacciona deja a
    // la persona sin saber si la app está rota o si hizo algo mal.
    if (!inicio || !fin) {
      return setError(
        "Faltan las fechas. Tocá los campos de arriba y elegí un día en el calendario; " +
          "si escribís a mano, la fecha tiene que quedar completa."
      );
    }
    const problema = validarRango(inicio, fin);
    if (problema) return setError(problema);
    if (aviso) return setError(aviso);

    setEnviando(true);
    try {
      const respuesta = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, inicio_en: inicio, fin_en: fin }),
      });
      const cuerpo = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        setError(cuerpo.error ?? "No se pudo reservar. Intentá de nuevo.");
        setEnviando(false);
        return;
      }
      router.push("/mis-reservas?nueva=1");
    } catch {
      setError("No pudimos conectarnos. Revisá tu internet e intentá de nuevo.");
      setEnviando(false);
    }
  }

  if (esMio) {
    return (
      <div className="rounded-xl border border-slate-200 p-5 text-center text-sm text-slate-600">
        Este ítem es tuyo. Acá van a aparecer las reservas que te hagan.
      </div>
    );
  }

  const claseCampo =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none " +
    "focus:border-slate-900 focus:ring-1 focus:ring-slate-900";

  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="inicio" className="block text-sm font-medium">Desde</label>
          <input
            id="inicio" type="date" min={hoy} value={inicio}
            onChange={(e) => { setInicio(e.target.value); if (fin && fin < e.target.value) setFin(e.target.value); }}
            className={claseCampo}
          />
        </div>
        <div>
          <label htmlFor="fin" className="block text-sm font-medium">Hasta</label>
          <input
            id="fin" type="date" min={inicio || hoy} value={fin}
            onChange={(e) => setFin(e.target.value)}
            className={claseCampo}
          />
        </div>
      </div>

      {listoParaReservar && (
        <dl className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
          {/* Repetir las fechas en palabras es la confirmación de que el campo
              sí tomó lo que la persona quiso poner. */}
          <p className="pb-2 font-medium text-slate-900">
            Reservás {formatearRango(inicio, fin)}
          </p>
          <div className="flex justify-between">
            <dt className="text-slate-600">
              {formatearQuetzales(precioPorDiaCentavos)} × {dias} {dias === 1 ? "día" : "días"}
            </dt>
            <dd>{formatearQuetzales(total)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatearQuetzales(total)}</dd>
          </div>
          <p className="pt-1 text-xs text-slate-500">
            Son {dias} {dias === 1 ? "día" : "días"}: se cuentan el primero y el último.
          </p>
        </dl>
      )}

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : aviso && (inicio || fin) ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{aviso}</p>
      ) : null}

      {haySesion ? (
        <button
          type="button"
          onClick={reservar}
          disabled={enviando}
          className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {enviando ? "Reservando…" : "Reservar"}
        </button>
      ) : (
        <a
          href={`/ingresar?volver_a=/item/${listingId}`}
          className="mt-4 block rounded-lg bg-slate-900 px-4 py-3 text-center font-medium text-white"
        >
          Ingresá para reservar
        </a>
      )}

      {diasOcupados.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Hay {diasOcupados.length} {diasOcupados.length === 1 ? "día ocupado" : "días ocupados"} en los próximos 3 meses.
        </p>
      )}
    </div>
  );
}
