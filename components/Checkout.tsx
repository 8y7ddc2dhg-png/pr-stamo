"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  agruparPorDueno, totalDelCarrito, vaciarCarrito, subtotalDeLinea,
} from "@/lib/carrito";
import { useCarrito, useHidratado } from "@/lib/useCarrito";
import { formatearQuetzales } from "@/lib/dinero";
import { formatearRango } from "@/lib/fechas";
import { CIUDADES } from "@/lib/ciudades";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { formatearTelefono } from "@/lib/validaciones";

const PASOS = ["Información", "Entrega", "Pago"] as const;

export default function Checkout({
  haySesion,
  datosIniciales,
}: {
  haySesion: boolean;
  datosIniciales: { nombre: string; apellido: string; correo: string; telefono: string; ciudad: string };
}) {
  const router = useRouter();

  const [paso, setPaso] = useState(0);
  const lineas = useCarrito();
  const hidratado = useHidratado();

  const [nombre, setNombre] = useState(datosIniciales.nombre);
  const [apellido, setApellido] = useState(datosIniciales.apellido);
  const [correo, setCorreo] = useState(datosIniciales.correo);
  const [telefono, setTelefono] = useState(datosIniciales.telefono);

  const [tipoEntrega, setTipoEntrega] = useState<"recoger" | "domicilio">("recoger");
  const [direccion, setDireccion] = useState("");
  const [zona, setZona] = useState(datosIniciales.ciudad);

  const [metodo, setMetodo] = useState<"efectivo" | "en_linea" | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // El ingreso pasa acá adentro, en el paso 1. Si no hay sesión, "Continuar"
  // manda el enlace al correo escrito y la pantalla se queda esperando. Cuando
  // la persona toca el enlace —en otra pestaña, normalmente— la sesión aparece
  // en las cookies del navegador, esta pestaña se da cuenta y avanza sola.
  const [sesionActiva, setSesionActiva] = useState(haySesion);
  const [esperandoCorreo, setEsperandoCorreo] = useState(false);
  const [correoEnviadoA, setCorreoEnviadoA] = useState("");

  const total = totalDelCarrito(lineas);
  const grupos = agruparPorDueno(lineas);

  /*
    Mientras se espera el correo, cada 3 segundos se le pregunta a Supabase si
    ya hay sesión. Cuando la persona toca el enlace en otra pestaña, la sesión
    queda en las cookies —que son las mismas para todas las pestañas— y esta
    la ve. Entonces trae los datos del perfil para rellenar lo que esté vacío
    y avanza al paso 2 sola. Se deja de preguntar a los 10 minutos: un enlace
    mágico no dura más que eso.
  */
  useEffect(() => {
    if (!esperandoCorreo) return;

    const supabase = crearClienteNavegador();
    const arranque = Date.now();
    let vivo = true;

    const reloj = setInterval(async () => {
      if (!vivo) return;
      if (Date.now() - arranque > 10 * 60 * 1000) {
        clearInterval(reloj);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !vivo) return;

      clearInterval(reloj);

      const { data: perfil } = await supabase
        .from("users")
        .select("nombre, telefono_whatsapp, ciudad")
        .eq("id", user.id)
        .maybeSingle();

      if (perfil?.nombre) {
        const partes = perfil.nombre.trim().split(/\s+/);
        setNombre((actual) => actual.trim() || partes[0] || "");
        setApellido((actual) => actual.trim() || partes.slice(1).join(" "));
      }
      if (perfil?.telefono_whatsapp) {
        setTelefono((actual) => actual.trim() || formatearTelefono(perfil.telefono_whatsapp));
      }
      if (perfil?.ciudad) setZona((actual) => actual || perfil.ciudad);

      setSesionActiva(true);
      setEsperandoCorreo(false);
      setError(null);
      setPaso(1);
    }, 3000);

    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [esperandoCorreo]);

  const campo =
    "mt-1.5 w-full rounded-xl border-[0.5px] border-tinta-300 bg-white px-4 py-3 text-base " +
    "outline-none placeholder:text-tinta-400 focus:border-marca-600";

  async function siguiente() {
    setError(null);

    if (paso === 0) {
      if (nombre.trim().length < 2) return setError("Escribí tu nombre.");
      if (apellido.trim().length < 2) return setError("Escribí tu apellido.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim()))
        return setError("Ese correo no parece válido.");
      if (telefono.replace(/\D/g, "").length < 8)
        return setError("El teléfono son 8 dígitos, por ejemplo 5512-3456.");

      // Sin sesión: el mismo correo del formulario sirve para entrar. Se manda
      // el enlace y NO se avanza. Crear la cuenta e ingresar son lo mismo: el
      // enlace hace las dos cosas.
      if (!sesionActiva) {
        setEnviando(true);
        try {
          const supabase = crearClienteNavegador();
          const destino = new URL("/auth/callback", window.location.origin);
          destino.searchParams.set("volver_a", "/checkout");

          const { error: fallo } = await supabase.auth.signInWithOtp({
            email: correo.trim(),
            options: { emailRedirectTo: destino.toString() },
          });

          if (fallo) {
            const esLimite = fallo.status === 429 || fallo.code === "over_email_send_rate_limit";
            setError(
              esLimite
                ? "Se alcanzó el límite de correos de la plataforma. Esperá unos minutos y volvé a intentar."
                : "No pudimos mandar el correo. Revisá que la dirección esté bien escrita e intentá de nuevo."
            );
            return;
          }

          setCorreoEnviadoA(correo.trim());
          setEsperandoCorreo(true);
        } catch (fallo) {
          setError(
            fallo instanceof Error && fallo.message.includes("Falta la variable")
              ? fallo.message
              : "No pudimos conectarnos. Revisá tu internet e intentá de nuevo."
          );
        } finally {
          setEnviando(false);
        }
        return;
      }
    }

    if (paso === 1 && tipoEntrega === "domicilio" && direccion.trim().length < 8) {
      return setError("Escribí la dirección completa para poder llevártelo.");
    }

    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
  }

  async function confirmar() {
    setError(null);
    if (!metodo) return setError("Elegí cómo querés pagar.");

    setEnviando(true);
    try {
      const respuesta = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineas: lineas.map((l) => ({ listingId: l.listingId, inicio: l.inicio, fin: l.fin })),
          nombre, apellido, correo, telefono,
          tipo_entrega: tipoEntrega,
          direccion: tipoEntrega === "domicilio" ? direccion : null,
          zona: tipoEntrega === "domicilio" ? zona : null,
          metodo_pago: metodo,
        }),
      });
      const cuerpo = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        // Cuando algo ya no está libre, la persona tiene que volver al carrito
        // a cambiar fechas. El carrito NO se vacía: sería perder todo por un
        // ítem.
        setError(cuerpo.error ?? "No se pudo confirmar el pedido.");
        setEnviando(false);
        return;
      }

      vaciarCarrito();
      router.push("/mis-pedidos?nuevo=1");
    } catch {
      setError("No pudimos conectarnos. Revisá tu internet e intentá de nuevo.");
      setEnviando(false);
    }
  }

  if (!hidratado) return <div className="h-64 animate-pulse rounded-xl bg-tinta-100" />;

  if (lineas.length === 0) {
    return (
      <div className="rounded-xl border-[0.5px] border-dashed border-tinta-300 bg-white px-6 py-14 text-center">
        <p className="font-medium">No hay nada que confirmar.</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full bg-marca-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-marca-900"
        >
          Ver el catálogo
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* El indicador numerado: se avanza de a un paso, y los ya cumplidos
          quedan marcados. Mostrar los tres desde el principio le dice a la
          persona cuánto falta, que es la diferencia entre esperar y abandonar. */}
      <ol className="flex items-center gap-2">
        {PASOS.map((nombrePaso, indice) => {
          const cumplido = indice < paso;
          const actual = indice === paso;
          return (
            <li key={nombrePaso} className="flex flex-1 items-center gap-2">
              <span
                aria-current={actual ? "step" : undefined}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  actual ? "bg-marca-800 text-white"
                  : cumplido ? "bg-marca-100 text-marca-800"
                  : "bg-tinta-200 text-tinta-500"
                }`}
              >
                {cumplido ? "✓" : indice + 1}
              </span>
              <span className={`hidden text-sm sm:block ${actual ? "font-medium" : "text-tinta-500"}`}>
                {nombrePaso}
              </span>
              {indice < PASOS.length - 1 && (
                <span className={`h-px flex-1 ${cumplido ? "bg-marca-300" : "bg-tinta-200"}`} />
              )}
            </li>
          );
        })}
      </ol>

      {/* En celular el nombre del paso no cabe al lado del número. */}
      <p className="mt-3 text-sm font-medium sm:hidden">
        Paso {paso + 1} de {PASOS.length}: {PASOS[paso]}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="rounded-xl border-[0.5px] border-tinta-200 bg-white p-4 sm:p-5">
          {paso === 0 && esperandoCorreo && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Revisá tu correo</h2>
              <p className="text-tinta-600">
                Le mandamos un enlace a <strong className="break-all">{correoEnviadoA}</strong>.
                Tocalo para confirmar e ingresar. <strong>Esta pantalla avanza sola</strong> en
                cuanto lo hagas; tu carrito queda guardado mientras tanto.
              </p>
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Si no lo ves en un minuto, <strong>fijate en spam</strong> o correo no deseado.
              </p>
              <div className="flex items-center gap-3 text-sm text-tinta-500">
                <span
                  aria-hidden
                  className="h-2 w-2 animate-pulse rounded-full bg-marca-600"
                />
                Esperando que toques el enlace…
              </div>
              <button
                type="button"
                onClick={() => { setEsperandoCorreo(false); setError(null); }}
                className="text-sm font-medium text-tinta-600 underline underline-offset-2"
              >
                Usar otro correo
              </button>
            </div>
          )}

          {paso === 0 && !esperandoCorreo && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="nombre" className="text-sm font-medium">Nombre</label>
                  <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
                         className={campo} placeholder="María" />
                </div>
                <div>
                  <label htmlFor="apellido" className="text-sm font-medium">Apellido</label>
                  <input id="apellido" value={apellido} onChange={(e) => setApellido(e.target.value)}
                         className={campo} placeholder="López" />
                </div>
              </div>

              <div>
                <label htmlFor="correo" className="text-sm font-medium">Correo</label>
                <input id="correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)}
                       className={campo} placeholder="vos@ejemplo.com" autoComplete="email" />
                {!sesionActiva && (
                  <p className="mt-1.5 text-xs text-tinta-500">
                    Con este correo entrás. Te mandamos un enlace; si no tenés cuenta, se
                    crea sola.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="telefono" className="text-sm font-medium">Teléfono</label>
                {/* El +502 va fijo al lado y no dentro del campo: así nadie lo
                    borra por accidente ni lo escribe dos veces. */}
                <div className="mt-1.5 flex items-stretch overflow-hidden rounded-xl border-[0.5px] border-tinta-300 bg-white focus-within:border-marca-600">
                  <span className="grid place-items-center border-r border-tinta-200 bg-tinta-100 px-3 text-sm text-tinta-600">
                    +502
                  </span>
                  <input
                    id="telefono" type="tel" inputMode="tel" value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="5512-3456"
                    className="min-w-0 flex-1 px-4 py-3 text-base outline-none placeholder:text-tinta-400"
                  />
                </div>
              </div>
            </div>
          )}

          {paso === 1 && (
            <div className="space-y-3">
              {([
                { valor: "recoger", titulo: "Recoger con el dueño",
                  detalle: "Se coordinan por el chat dónde y a qué hora." },
                { valor: "domicilio", titulo: "Entrega a domicilio",
                  detalle: "El dueño te lo lleva a la dirección que pongas." },
              ] as const).map((opcion) => (
                <label
                  key={opcion.valor}
                  className={`flex cursor-pointer gap-3 rounded-xl border-[0.5px] p-4 transition-colors ${
                    tipoEntrega === opcion.valor
                      ? "border-marca-600 bg-marca-50"
                      : "border-tinta-300 bg-white hover:border-tinta-400"
                  }`}
                >
                  <input
                    type="radio" name="entrega" value={opcion.valor}
                    checked={tipoEntrega === opcion.valor}
                    onChange={() => setTipoEntrega(opcion.valor)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#1a5549]"
                  />
                  <span>
                    <span className="block font-medium">{opcion.titulo}</span>
                    <span className="block text-sm text-tinta-600">{opcion.detalle}</span>
                  </span>
                </label>
              ))}

              {tipoEntrega === "domicilio" && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label htmlFor="direccion" className="text-sm font-medium">Dirección</label>
                    <input id="direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)}
                           className={campo} placeholder="11 avenida 5-42, colonia El Rosario" />
                  </div>
                  <div>
                    <label htmlFor="zona" className="text-sm font-medium">Zona o municipio</label>
                    <select id="zona" value={zona} onChange={(e) => setZona(e.target.value)} className={campo}>
                      <option value="">Elegí una…</option>
                      {CIUDADES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-3">
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <strong>Pago simulado.</strong> Esta demostración no cobra dinero de verdad
                ni se conecta con ningún banco.
              </p>

              {([
                { valor: "efectivo", titulo: "Efectivo al recibir",
                  detalle: "Le pagás al dueño cuando te entregue las cosas." },
                { valor: "en_linea", titulo: "Pago en línea",
                  detalle: "Queda registrado como pagado de inmediato." },
              ] as const).map((opcion) => (
                <label
                  key={opcion.valor}
                  className={`flex cursor-pointer gap-3 rounded-xl border-[0.5px] p-4 transition-colors ${
                    metodo === opcion.valor
                      ? "border-marca-600 bg-marca-50"
                      : "border-tinta-300 bg-white hover:border-tinta-400"
                  }`}
                >
                  <input
                    type="radio" name="pago" value={opcion.valor}
                    checked={metodo === opcion.valor}
                    onChange={() => setMetodo(opcion.valor)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#1a5549]"
                  />
                  <span>
                    <span className="block font-medium">{opcion.titulo}</span>
                    <span className="block text-sm text-tinta-600">{opcion.detalle}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}{" "}
              <Link href="/carrito" className="font-medium underline">Volver al carrito</Link>
            </p>
          )}

          {!esperandoCorreo && (
          <div className="mt-6 flex items-center gap-3">
            {paso > 0 ? (
              <button
                type="button"
                onClick={() => { setError(null); setPaso((p) => p - 1); }}
                className="rounded-xl border-[0.5px] border-tinta-300 bg-white px-5 py-3 font-medium hover:border-tinta-400"
              >
                Atrás
              </button>
            ) : (
              <Link
                href="/carrito"
                className="rounded-xl border-[0.5px] border-tinta-300 bg-white px-5 py-3 font-medium hover:border-tinta-400"
              >
                Atrás
              </Link>
            )}

            {paso < PASOS.length - 1 ? (
              <button
                type="button" onClick={siguiente} disabled={enviando}
                className="flex-1 rounded-xl bg-marca-800 px-5 py-3 font-medium text-white hover:bg-marca-900 disabled:opacity-50"
              >
                {enviando
                  ? "Mandando el enlace…"
                  : paso === 0 && !sesionActiva
                    ? "Continuar e ingresar"
                    : "Continuar"}
              </button>
            ) : (
              <button
                type="button" onClick={confirmar} disabled={enviando}
                className="flex-1 rounded-xl bg-marca-800 px-5 py-3 font-medium text-white disabled:opacity-50"
              >
                {enviando ? "Confirmando…" : `Confirmar ${formatearQuetzales(total)}`}
              </button>
            )}
          </div>
          )}
        </div>

        <aside className="rounded-xl border-[0.5px] border-tinta-200 bg-white p-4 lg:sticky lg:top-20">
          <h2 className="font-medium">Tu pedido</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {lineas.map((l) => (
              <li key={`${l.listingId}-${l.inicio}-${l.fin}`} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate">{l.titulo}</span>
                  <span className="block text-xs text-tinta-500">
                    {formatearRango(l.inicio, l.fin)}
                  </span>
                </span>
                <span className="shrink-0">{formatearQuetzales(subtotalDeLinea(l))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-tinta-200 pt-3 text-base font-semibold">
            <span>Total</span>
            <span>{formatearQuetzales(total)}</span>
          </div>
          {grupos.length > 1 && (
            <p className="mt-3 text-xs text-tinta-500">
              Se van a crear {grupos.length} pedidos, uno por cada dueño.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
