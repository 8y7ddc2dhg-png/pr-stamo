import { contarDias, type FechaISO } from "@/lib/fechas";

/**
 * El carrito vive en el navegador de cada quien (localStorage), no en la base
 * de datos.
 *
 * POR QUÉ: un carrito es una intención, no un compromiso. Guardarlo en el
 * servidor obligaría a tener sesión para agregar algo —justo cuando alguien
 * todavía está mirando— y a limpiar carritos abandonados para siempre. En el
 * navegador es gratis, instantáneo y desaparece solo.
 *
 * LO QUE ESTO IMPLICA, y hay que tenerlo claro: el carrito NO es una reserva.
 * Que algo esté en el carrito no lo aparta ni lo bloquea para nadie. Los
 * precios y la disponibilidad guardados acá son una foto vieja; al confirmar,
 * el servidor los vuelve a leer de la base y puede rechazar la compra. Nada de
 * lo que hay en este archivo decide nada sobre dinero.
 */

const CLAVE = "prestamo:carrito";
const VERSION = 1;

export type LineaCarrito = {
  listingId: string;
  titulo: string;
  fotoUrl: string | null;
  ciudad: string;
  precioPorDiaCentavos: number;
  publicadorId: string;
  publicadorNombre: string;
  inicio: FechaISO;
  fin: FechaISO;
};

type CarritoGuardado = { version: number; lineas: LineaCarrito[] };

/** Aviso para que el ícono del encabezado se entere sin recargar la página. */
export const EVENTO_CARRITO = "prestamo:carrito-cambio";

function esLineaValida(l: unknown): l is LineaCarrito {
  const x = l as Partial<LineaCarrito>;
  return (
    typeof x?.listingId === "string" &&
    typeof x?.titulo === "string" &&
    typeof x?.precioPorDiaCentavos === "number" &&
    typeof x?.inicio === "string" &&
    typeof x?.fin === "string" &&
    typeof x?.publicadorId === "string"
  );
}

export function leerCarrito(): LineaCarrito[] {
  // En el servidor no hay localStorage. Devolver vacío evita tener que
  // preguntar "¿estoy en el navegador?" en cada pantalla que use esto.
  if (typeof window === "undefined") return [];

  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const guardado = JSON.parse(crudo) as CarritoGuardado;

    // Si el formato cambió en una versión futura, se descarta en vez de
    // intentar adivinar. Un carrito perdido molesta; uno mal leído cobra mal.
    if (guardado?.version !== VERSION || !Array.isArray(guardado.lineas)) return [];
    return guardado.lineas.filter(esLineaValida);
  } catch {
    // localStorage puede fallar en ventanas privadas o con las cookies
    // bloqueadas. El carrito se pierde, y la app sigue funcionando.
    return [];
  }
}

function guardar(lineas: LineaCarrito[]): void {
  if (typeof window === "undefined") return;
  try {
    const dato: CarritoGuardado = { version: VERSION, lineas };
    window.localStorage.setItem(CLAVE, JSON.stringify(dato));
  } catch {
    // Sin espacio o sin permiso: no se puede hacer más que seguir.
  }
  window.dispatchEvent(new CustomEvent(EVENTO_CARRITO));
}

/** Dos líneas son la misma si son el mismo ítem en las mismas fechas. */
function mismaLinea(a: LineaCarrito, b: LineaCarrito): boolean {
  return a.listingId === b.listingId && a.inicio === b.inicio && a.fin === b.fin;
}

/** Devuelve false si esa combinación de ítem y fechas ya estaba. */
export function agregarAlCarrito(linea: LineaCarrito): boolean {
  const lineas = leerCarrito();
  if (lineas.some((l) => mismaLinea(l, linea))) return false;
  guardar([...lineas, linea]);
  return true;
}

export function quitarDelCarrito(linea: LineaCarrito): void {
  guardar(leerCarrito().filter((l) => !mismaLinea(l, linea)));
}

export function vaciarCarrito(): void {
  guardar([]);
}

export function diasDeLinea(linea: LineaCarrito): number {
  try {
    return contarDias(linea.inicio, linea.fin);
  } catch {
    return 0;
  }
}

/** Precio por día × días. Es solo para mostrar: el servidor lo recalcula. */
export function subtotalDeLinea(linea: LineaCarrito): number {
  return linea.precioPorDiaCentavos * diasDeLinea(linea);
}

export function totalDelCarrito(lineas: LineaCarrito[]): number {
  return lineas.reduce((suma, l) => suma + subtotalDeLinea(l), 0);
}

/** Agrupa por dueño, que es como se van a crear los pedidos. */
export function agruparPorDueno(lineas: LineaCarrito[]) {
  const grupos = new Map<string, { nombre: string; lineas: LineaCarrito[] }>();
  for (const l of lineas) {
    const grupo = grupos.get(l.publicadorId) ?? { nombre: l.publicadorNombre, lineas: [] };
    grupo.lineas.push(l);
    grupos.set(l.publicadorId, grupo);
  }
  return [...grupos.entries()].map(([id, g]) => ({ publicadorId: id, ...g }));
}


/* ── El carrito como fuente externa de datos ──────────────────────────────────

  React tiene una forma propia de leer datos que viven FUERA de React
  —localStorage es uno— y es `useSyncExternalStore`. Necesita tres cosas: cómo
  suscribirse a los cambios, cómo tomar una foto del estado actual, y qué
  contestar cuando el HTML lo arma el servidor, donde no hay navegador.

  EL DETALLE QUE IMPORTA: la foto tiene que devolver EL MISMO objeto mientras
  nada cambie. Si cada llamada devolviera un arreglo nuevo, React creería que
  el carrito cambió sin parar y volvería a dibujar la pantalla para siempre.
  Por eso se guarda el texto crudo y solo se vuelve a interpretar cuando ese
  texto es distinto.
*/

const VACIO: LineaCarrito[] = [];
let fotoLineas: LineaCarrito[] = VACIO;
let fotoCruda: string | null = null;
let hayFoto = false;

export function suscribirseAlCarrito(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO_CARRITO, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO_CARRITO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

export function fotoDelCarrito(): LineaCarrito[] {
  let crudo: string | null = null;
  try {
    crudo = window.localStorage.getItem(CLAVE);
  } catch {
    crudo = null;
  }
  if (!hayFoto || crudo !== fotoCruda) {
    fotoCruda = crudo;
    fotoLineas = leerCarrito();
    hayFoto = true;
  }
  return fotoLineas;
}

/** En el servidor el carrito siempre se ve vacío: no hay navegador que leer. */
export function fotoDelCarritoEnServidor(): LineaCarrito[] {
  return VACIO;
}
