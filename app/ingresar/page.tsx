"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

/**
 * Pantalla de ingreso.
 *
 * No hay contraseñas: se manda un enlace al correo y con tocarlo se entra.
 * Eso nos ahorra programar "olvidé mi contraseña", las reglas de contraseña
 * segura, y el riesgo de guardar contraseñas mal. Menos código y menos cosas
 * que se pueden romper.
 *
 * El costo real: si el correo cae en spam o la persona no revisa su correo
 * desde el teléfono, se pierde. Por eso el aviso de "revisá spam" es grande.
 */
function FormularioIngreso() {
  const parametros = useSearchParams();
  const volverA = parametros.get("volver_a") ?? "";
  const errorDeEnlace = parametros.get("error");

  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviado">("listo");
  const [error, setError] = useState<string | null>(
    errorDeEnlace === "enlace_vencido"
      ? "Ese enlace ya venció o ya se usó. Pedí uno nuevo."
      : null
  );

  async function enviarEnlace(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setEstado("enviando");

    // TODO envuelto en try/catch a propósito: sin esto, cualquier error
    // —falta de configuración, sin internet, Supabase caído— dejaba el botón
    // trabado en "Mandando…" para siempre y sin ningún mensaje. Un botón que
    // no responde es la peor forma posible de reportar una falla.
    try {
      const supabase = crearClienteNavegador();
      const destino = new URL("/auth/callback", window.location.origin);
      if (volverA) destino.searchParams.set("volver_a", volverA);

      const { error: fallo } = await supabase.auth.signInWithOtp({
        email: correo.trim(),
        options: { emailRedirectTo: destino.toString() },
      });

      if (fallo) {
        // Distinguir el límite de envíos del resto importa: mandaba a la gente
        // a revisar su dirección cuando el problema era otro y no dependía de
        // ellos. Un mensaje de error que apunta al lugar equivocado hace perder
        // más tiempo que no decir nada.
        const esLimite =
          fallo.status === 429 || fallo.code === "over_email_send_rate_limit";

        setError(
          esLimite
            ? "Se alcanzó el límite de correos de la plataforma. Esperá unos minutos y volvé a intentar. " +
              "Si esto pasa seguido, hay que conectar el servidor de correo propio (ver README)."
            : "No pudimos mandar el correo. Revisá que la dirección esté bien escrita e intentá de nuevo."
        );
        return;
      }

      setEstado("enviado");
    } catch (fallo) {
      // Si falta una variable de entorno, el mensaje de lib/entorno.ts dice
      // exactamente cuál y dónde ponerla. Vale más mostrarlo que esconderlo.
      setError(
        fallo instanceof Error && fallo.message.includes("Falta la variable")
          ? fallo.message
          : "No pudimos conectarnos. Revisá tu internet e intentá de nuevo."
      );
    } finally {
      // Pase lo que pase, el botón vuelve a estar disponible.
      setEstado((actual) => (actual === "enviado" ? actual : "listo"));
    }
  }

  if (estado === "enviado") {
    return (
      <div className="rounded-xl border-[0.5px] border-tinta-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Revisá tu correo</h2>
        <p className="mt-2 text-tinta-600">
          Le mandamos un enlace a <strong className="break-all">{correo}</strong>.
          Tocalo y entrás directo, sin contraseña.
        </p>
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Si no lo ves en un minuto, <strong>fijate en la carpeta de spam</strong> o
          correo no deseado. Es lo que pasa más seguido.
        </p>
        <button
          type="button"
          onClick={() => setEstado("listo")}
          className="mt-4 text-sm font-medium text-tinta-600 underline underline-offset-2"
        >
          Usar otro correo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviarEnlace} className="rounded-xl border-[0.5px] border-tinta-200 bg-white p-5 sm:p-6">
      <label htmlFor="correo" className="block text-sm font-medium">
        Tu correo electrónico
      </label>
      <input
        id="correo"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        placeholder="vos@ejemplo.com"
        // text-base (16px) evita que el iPhone haga zoom solo al tocar el campo.
        className="mt-2 w-full rounded-xl border-[0.5px] border-tinta-300 px-4 py-3 text-base
                   outline-none focus:border-marca-600 focus:ring-1 focus:ring-marca-600"
      />

      {error && (
        <p className="mt-3 whitespace-pre-line rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={estado === "enviando"}
        className="mt-4 w-full rounded-xl bg-marca-800 px-4 py-3 text-base font-medium
                   text-white disabled:opacity-60"
      >
        {estado === "enviando" ? "Mandando…" : "Mandame el enlace"}
      </button>

      <p className="mt-4 text-sm text-tinta-500">
        No usamos contraseñas. Te mandamos un enlace al correo y con tocarlo entrás.
      </p>
    </form>
  );
}

export default function PaginaIngreso() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold leading-tight">Ingresar a Prestamo</h1>
      <p className="mt-2 text-tinta-600">
        Para publicar algo o rentar, necesitamos saber quién sos.
      </p>

      <div className="mt-6">
        {/* useSearchParams necesita estar dentro de Suspense en Next.js */}
        <Suspense fallback={<div className="h-64 rounded-xl bg-tinta-100" />}>
          <FormularioIngreso />
        </Suspense>
      </div>
    </main>
  );
}
