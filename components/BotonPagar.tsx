"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * ⚠️ PAGO SIMULADO. No cobra nada, no toca ningún banco.
 * Ver la explicación completa en app/api/reservas/[id]/pago/route.ts.
 */
export default function BotonPagar({ reservaId }: { reservaId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pagar(metodo: "en_linea" | "efectivo") {
    setError(null);
    setEnviando(metodo);
    try {
      const respuesta = await fetch(`/api/reservas/${reservaId}/pago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metodo }),
      });
      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setError(cuerpo.error ?? "No se pudo registrar el pago.");
        setEnviando(null);
        return;
      }
      setAbierto(false);
      router.refresh();
    } catch {
      setError("No pudimos conectarnos. Intentá de nuevo.");
      setEnviando(null);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Pagar
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border border-slate-200 p-4">
      <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>Pago simulado.</strong> Esta demostración no cobra dinero de verdad
        ni se conecta con ningún banco.
      </p>

      <p className="mt-3 text-sm font-medium">¿Cómo querés pagar?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button
          type="button" onClick={() => pagar("en_linea")} disabled={Boolean(enviando)}
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium hover:border-slate-900 disabled:opacity-50"
        >
          {enviando === "en_linea" ? "Procesando…" : "En línea"}
        </button>
        <button
          type="button" onClick={() => pagar("efectivo")} disabled={Boolean(enviando)}
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium hover:border-slate-900 disabled:opacity-50"
        >
          {enviando === "efectivo" ? "Procesando…" : "En efectivo al recibir"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <button
        type="button" onClick={() => setAbierto(false)}
        className="mt-3 text-sm text-slate-500 underline"
      >
        Cancelar
      </button>
    </div>
  );
}
