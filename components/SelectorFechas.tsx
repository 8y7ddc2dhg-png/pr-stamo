"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { contarDias, formatearRango, hoyEnGuatemala, sumarDias, validarRango } from "@/lib/fechas";
import { formatearQuetzales } from "@/lib/dinero";
import { agregarAlCarrito } from "@/lib/carrito";

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
  titulo,
  fotoUrl,
  ciudad,
  precioPorDiaCentavos,
  publicadorId,
  publicadorNombre,
  diasOcupados,
  haySesion,
  esMio,
}: {
  listingId: string;
  titulo: string;
  fotoUrl: string | null;
  ciudad: string;
  precioPorDiaCentavos: number;
  publicadorId: string;
  publicadorNombre: string;
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

  const [avisoCarrito, setAvisoCarrito] = useState<string | null>(null);

  const refInicio = useRef<HTMLInputElement>(null);
  const refFin = useRef<HTMLInputElement>(null);

  /*
    Si alguien escribe una fecha ANTES de que termine de cargar el JavaScript,
    el navegador la guarda en el campo pero React todavía no existe para
    enterarse. Resultado: la persona ve la fecha en pantalla y el código la ve
    vacía, así que el botón contesta "faltan las fechas" sobre un campo que
    claramente tiene una. Esto lee lo que el campo ya trae y lo mete al estado.
  */
  useEffect(() => {
    const desdeElCampo = refInicio.current?.value;
    const hastaElCampo = refFin.current?.value;
    if (desdeElCampo) setInicio((actual) => actual || desdeElCampo);
    if (hastaElCampo) setFin((actual) => actual || hastaElCampo);
  }, []);

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

    // Se lee del campo si el estado viniera vacío: lo que la persona VE en
    // pantalla manda sobre lo que el código cree tener guardado.
    const desde = inicio || refInicio.current?.value || "";
    const hasta = fin || refFin.current?.value || "";
    if (desde !== inicio) setInicio(desde);
    if (hasta !== fin) setFin(hasta);

    // El botón ya NO está deshabilitado cuando faltan datos: se puede apretar
    // y responde diciendo qué falta. Un control gris que no reacciona deja a
    // la persona sin saber si la app está rota o si hizo algo mal.
    if (!desde || !hasta) {
      return setError(
        "Faltan las fechas. Tocá los campos de arriba y elegí un día en el calendario; " +
          "si escribís a mano, la fecha tiene que quedar completa."
      );
    }
    const problema = validarRango(desde, hasta);
    if (problema) return setError(problema);

    // La disponibilidad se revisa contra las fechas recién leídas, no contra
    // el aviso calculado en el render anterior, que podría estar desfasado.
    const diasPedidos = contarDias(desde, hasta);
    for (let i = 0; i < diasPedidos; i++) {
      if (ocupados.has(sumarDias(desde, i))) {
        return setError("Alguno de esos días ya está reservado. Probá con otras fechas.");
      }
    }

    setEnviando(true);
    try {
      const respuesta = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, inicio_en: desde, fin_en: hasta }),
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

  /**
   * Agregar al carrito comparte las validaciones con reservar: no tendría
   * sentido dejar meter al carrito unas fechas que después se van a rechazar.
   * Lo que NO hace es apartar nada: el carrito es una intención, y la
   * disponibilidad se vuelve a verificar al confirmar la compra.
   */
  function agregarAlCarritoDesdeAqui() {
    setError(null);
    setAvisoCarrito(null);

    const desde = inicio || refInicio.current?.value || "";
    const hasta = fin || refFin.current?.value || "";
    if (desde !== inicio) setInicio(desde);
    if (hasta !== fin) setFin(hasta);

    if (!desde || !hasta) {
      return setError("Elegí las fechas antes de agregar al carrito.");
    }
    const problema = validarRango(desde, hasta);
    if (problema) return setError(problema);

    const diasPedidos = contarDias(desde, hasta);
    for (let i = 0; i < diasPedidos; i++) {
      if (ocupados.has(sumarDias(desde, i))) {
        return setError("Alguno de esos días ya está reservado. Probá con otras fechas.");
      }
    }

    const seAgrego = agregarAlCarrito({
      listingId, titulo, fotoUrl, ciudad, precioPorDiaCentavos,
      publicadorId, publicadorNombre, inicio: desde, fin: hasta,
    });

    setAvisoCarrito(
      seAgrego
        ? "Agregado al carrito."
        : "Eso ya estaba en tu carrito con esas mismas fechas."
    );
  }

  if (esMio) {
    return (
      <div className="rounded-xl border-[0.5px] border-tinta-200 p-5 text-center text-sm text-tinta-600">
        Este ítem es tuyo. Acá van a aparecer las reservas que te hagan.
      </div>
    );
  }

  const claseCampo =
    "mt-1 w-full rounded-xl border-[0.5px] border-tinta-300 px-3 py-2.5 text-base outline-none " +
    "focus:border-marca-600 focus:ring-1 focus:ring-marca-600";

  return (
    <div className="rounded-xl border-[0.5px] border-tinta-200 p-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="inicio" className="block text-sm font-medium">Desde</label>
          <input
            id="inicio" ref={refInicio} type="date" min={hoy} value={inicio}
            onChange={(e) => { setInicio(e.target.value); if (fin && fin < e.target.value) setFin(e.target.value); }}
            className={claseCampo}
          />
        </div>
        <div>
          <label htmlFor="fin" className="block text-sm font-medium">Hasta</label>
          <input
            id="fin" ref={refFin} type="date" min={inicio || hoy} value={fin}
            onChange={(e) => setFin(e.target.value)}
            className={claseCampo}
          />
        </div>
      </div>

      {listoParaReservar && (
        <dl className="mt-4 space-y-1 border-t border-tinta-200 pt-4 text-sm">
          {/* Repetir las fechas en palabras es la confirmación de que el campo
              sí tomó lo que la persona quiso poner. */}
          <p className="pb-2 font-medium text-tinta-900">
            Reservás {formatearRango(inicio, fin)}
          </p>
          <div className="flex justify-between">
            <dt className="text-tinta-600">
              {formatearQuetzales(precioPorDiaCentavos)} × {dias} {dias === 1 ? "día" : "días"}
            </dt>
            <dd>{formatearQuetzales(total)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatearQuetzales(total)}</dd>
          </div>
          <p className="pt-1 text-xs text-tinta-500">
            {inicio === fin
              ? "Un solo día: lo recibís y lo devolvés el mismo día."
              : `Son ${dias} días: se cuentan el primero y el último.`}
          </p>
        </dl>
      )}

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : aviso && (inicio || fin) ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{aviso}</p>
      ) : null}

      {haySesion ? (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={reservar}
            disabled={enviando}
            className="w-full rounded-xl bg-marca-800 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {enviando ? "Reservando…" : "Reservar"}
          </button>

          {/* Dos caminos que conviven: reservar de una, o juntar varias cosas y
              pagarlas de una sola vez. El de reserva directa va primero porque
              es el más corto. */}
          <button
            type="button"
            onClick={agregarAlCarritoDesdeAqui}
            className="w-full rounded-xl border-[0.5px] border-tinta-300 bg-white px-4 py-3
                       font-medium transition-colors hover:border-tinta-400"
          >
            Agregar al carrito
          </button>

          {avisoCarrito && (
            <p className="rounded-xl bg-marca-50 px-3 py-2 text-sm text-marca-800">
              {avisoCarrito}{" "}
              <a href="/carrito" className="font-medium underline">Ver carrito</a>
            </p>
          )}
        </div>
      ) : (
        <a
          href={`/ingresar?volver_a=/item/${listingId}`}
          className="mt-4 block rounded-xl bg-marca-800 px-4 py-3 text-center font-medium text-white"
        >
          Ingresá para reservar
        </a>
      )}

      {diasOcupados.length > 0 && (
        <p className="mt-3 text-xs text-tinta-500">
          Hay {diasOcupados.length} {diasOcupados.length === 1 ? "día ocupado" : "días ocupados"} en los próximos 3 meses.
        </p>
      )}
    </div>
  );
}
