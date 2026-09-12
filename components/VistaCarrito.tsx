"use client";

import Link from "next/link";
import Image from "next/image";
import {
  agruparPorDueno, diasDeLinea, quitarDelCarrito,
  subtotalDeLinea, totalDelCarrito,
} from "@/lib/carrito";
import { useCarrito, useHidratado } from "@/lib/useCarrito";
import { formatearQuetzales } from "@/lib/dinero";
import { formatearRango } from "@/lib/fechas";

export default function VistaCarrito({ haySesion }: { haySesion: boolean }) {
  const lineas = useCarrito();
  // El carrito vive en el navegador, así que el HTML del servidor siempre lo ve
  // vacío. Sin esta bandera, la pantalla mostraría "tu carrito está vacío" por
  // un instante a alguien que sí tiene cosas adentro.
  const hidratado = useHidratado();

  if (!hidratado) {
    return <div className="h-64 animate-pulse rounded-xl bg-tinta-100" />;
  }

  if (lineas.length === 0) {
    return (
      <div className="rounded-xl border-[0.5px] border-dashed border-tinta-300 bg-white px-6 py-14 text-center">
        <p className="font-medium">Tu carrito está vacío.</p>
        <p className="mt-1 text-tinta-600">
          Buscá algo en el catálogo, elegí las fechas y agregalo acá.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full bg-marca-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-marca-900"
        >
          Ver el catálogo
        </Link>
      </div>
    );
  }

  const grupos = agruparPorDueno(lineas);
  const total = totalDelCarrito(lineas);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="space-y-5">
        {/* Agrupado por dueño porque así se va a cobrar y a entregar: cada
            dueño tiene sus propias cosas, en su propia casa. Verlo así desde
            el carrito evita la sorpresa de recibir tres pedidos al confirmar. */}
        {grupos.map((grupo) => (
          <section
            key={grupo.publicadorId}
            className="overflow-hidden rounded-xl border-[0.5px] border-tinta-200 bg-white"
          >
            <header className="border-b border-tinta-200 px-4 py-3">
              <h2 className="text-sm font-medium">{grupo.nombre}</h2>
              <p className="text-xs text-tinta-500">
                {grupo.lineas.length === 1 ? "1 ítem" : `${grupo.lineas.length} ítems`} · se
                coordina por separado
              </p>
            </header>

            <ul className="divide-y divide-tinta-200">
              {grupo.lineas.map((linea) => (
                <li
                  key={`${linea.listingId}-${linea.inicio}-${linea.fin}`}
                  className="flex items-start gap-3 p-4"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-tinta-100">
                    {linea.fotoUrl && (
                      <Image src={linea.fotoUrl} alt="" fill className="object-cover" sizes="64px" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link href={`/item/${linea.listingId}`} className="font-medium hover:underline">
                      {linea.titulo}
                    </Link>
                    <p className="mt-0.5 text-sm text-tinta-600">
                      {formatearRango(linea.inicio, linea.fin)}
                    </p>
                    <p className="text-xs text-tinta-500">
                      {formatearQuetzales(linea.precioPorDiaCentavos)} × {diasDeLinea(linea)}{" "}
                      {diasDeLinea(linea) === 1 ? "día" : "días"} · {linea.ciudad}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-medium">{formatearQuetzales(subtotalDeLinea(linea))}</p>
                    <button
                      type="button"
                      onClick={() => quitarDelCarrito(linea)}
                      className="mt-1 text-xs text-tinta-500 underline hover:text-red-700"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="lg:sticky lg:top-20">
        <div className="rounded-xl border-[0.5px] border-tinta-200 bg-white p-4">
          <h2 className="font-medium">Resumen</h2>

          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-tinta-600">
                Subtotal ({lineas.length} {lineas.length === 1 ? "ítem" : "ítems"})
              </dt>
              <dd>{formatearQuetzales(total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-600">Entrega</dt>
              <dd className="text-tinta-500">Se define al confirmar</dd>
            </div>
            <div className="flex justify-between border-t border-tinta-200 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatearQuetzales(total)}</dd>
            </div>
          </dl>

          {grupos.length > 1 && (
            <p className="mt-3 rounded-xl bg-tinta-100 px-3 py-2 text-xs text-tinta-600">
              Son cosas de {grupos.length} personas distintas, así que al confirmar
              se van a crear {grupos.length} pedidos separados.
            </p>
          )}

          {/* Sin sesión, el botón dice a dónde va de verdad. "Continuar" a secas
              y un rebote a la pantalla de ingreso se sienten como un error;
              anunciarlo lo vuelve un paso esperado. Crear la cuenta e ingresar
              son lo mismo: el enlace al correo hace las dos cosas. */}
          {!haySesion && (
            <p className="mt-3 rounded-xl bg-tinta-100 px-3 py-2 text-xs text-tinta-600">
              Para confirmar vas a ingresar con tu correo. Si no tenés cuenta, se crea
              en ese mismo paso. Tu carrito se conserva.
            </p>
          )}

          <Link
            href="/checkout"
            className="mt-4 block rounded-xl bg-marca-800 px-4 py-3 text-center font-medium text-white hover:bg-marca-900"
          >
            {haySesion ? "Continuar" : "Ingresar y continuar"}
          </Link>

          <Link href="/" className="mt-2 block text-center text-sm text-tinta-500 hover:text-tinta-900">
            Seguir buscando
          </Link>
        </div>
      </aside>
    </div>
  );
}
