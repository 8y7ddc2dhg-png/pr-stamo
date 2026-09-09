"use client";

import Link from "next/link";
import { useCarrito } from "@/lib/useCarrito";

/**
 * El ícono del carrito con su contador.
 *
 * Arranca en cero porque el HTML lo arma el servidor, que no puede saber qué
 * hay en el navegador de cada quien. Apenas el navegador toma el control,
 * aparece el número real.
 *
 * Se entera de los cambios de esta pestaña y también de otras pestañas
 * abiertas, porque el carrito es el mismo para todas.
 */
export default function ContadorCarrito() {
  const cuantos = useCarrito().length;

  return (
    <Link
      href="/carrito"
      aria-label={cuantos === 0 ? "Carrito vacío" : `Carrito con ${cuantos}`}
      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full
                 border-[0.5px] border-tinta-300 bg-white transition-colors hover:border-tinta-400"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]"
           fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.4 10.4a1.5 1.5 0 0 0 1.5 1.1h7.7a1.5 1.5 0 0 0 1.5-1.2L19.5 8H6" />
        <circle cx="9.5" cy="19" r="1.3" />
        <circle cx="17" cy="19" r="1.3" />
      </svg>

      {cuantos > 0 && (
        <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center
                         rounded-full bg-marca-800 px-1 text-[11px] font-semibold text-white">
          {cuantos}
        </span>
      )}
    </Link>
  );
}
