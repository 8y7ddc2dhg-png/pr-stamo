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

    const supabase = crearClienteNavegador();
    const destino = new URL("/auth/callback", window.location.origin);
    if (volverA) destino.searchParams.set("volver_a", volverA);

    const { error: fallo } = await supabase.auth.signInWithOtp({
      email: correo.trim(),
      options: { emailRedirectTo: destino.toString() },
    });

    if (fallo) {
      setEstado("listo");
      setError(
        "No pudimos mandar el correo. Revisá que la dirección esté bien escrita e intentá de nuevo."
      );
      return;
    }

    setEstado("enviado");
  }

  if (estado === "enviado") {
    return (
      <div className="rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold">Revisá tu correo</h2>
        <p className="mt-2 text-slate-600">
          Le mandamos un enlace a <strong className="break-all">{correo}</strong>.
          Tocalo y entrás directo, sin contraseña.
        </p>
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Si no lo ves en un minuto, <strong>fijate en la carpeta de spam</strong> o
          correo no deseado. Es lo que pasa más seguido.
        </p>
        <button
          type="button"
          onClick={() => setEstado("listo")}
          className="mt-4 text-sm font-medium text-slate-600 underline underline-offset-2"
        >
          Usar otro correo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviarEnlace} className="rounded-xl border border-slate-200 p-6">
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
        className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-base
                   outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
      />

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={estado === "enviando"}
        className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-medium
                   text-white disabled:opacity-60"
      >
        {estado === "enviando" ? "Mandando…" : "Mandame el enlace"}
      </button>

      <p className="mt-4 text-sm text-slate-500">
        No usamos contraseñas. Te mandamos un enlace al correo y con tocarlo entrás.
      </p>
    </form>
  );
}

export default function PaginaIngreso() {
  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Ingresar a Prestamo</h1>
      <p className="mt-2 text-slate-600">
        Para publicar algo o rentar, necesitamos saber quién sos.
      </p>

      <div className="mt-8">
        {/* useSearchParams necesita estar dentro de Suspense en Next.js */}
        <Suspense fallback={<div className="h-64 rounded-xl bg-slate-50" />}>
          <FormularioIngreso />
        </Suspense>
      </div>
    </main>
  );
}
