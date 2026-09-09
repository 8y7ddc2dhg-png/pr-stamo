"use client";

import { useSyncExternalStore } from "react";

/*
  ── Por qué estos dos nombres NO están en español ───────────────────────────

  El proyecto nombra todo en español (ver CLAUDE.md), pero React EXIGE que los
  hooks empiecen con "use". No es una preferencia de estilo: es así como el
  compilador y el revisor de código los reconocen para verificar que se usen
  bien. Un hook llamado "usarCarrito" no se revisa, y los errores de hooks mal
  usados son de los más difíciles de rastrear.

  Es la única excepción a la regla de nombres en todo el proyecto.
*/
import {
  fotoDelCarrito, fotoDelCarritoEnServidor, suscribirseAlCarrito,
  type LineaCarrito,
} from "@/lib/carrito";

/** Las líneas del carrito, al día, sin efectos ni estado propio. */
export function useCarrito(): LineaCarrito[] {
  return useSyncExternalStore(
    suscribirseAlCarrito,
    fotoDelCarrito,
    fotoDelCarritoEnServidor
  );
}

/**
 * ¿Ya estamos corriendo en el navegador?
 *
 * Sirve para no mostrar "tu carrito está vacío" durante el instante en que el
 * HTML viene del servidor —donde el carrito SIEMPRE se ve vacío— antes de que
 * el navegador tome el control y lea lo que de verdad hay guardado.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
