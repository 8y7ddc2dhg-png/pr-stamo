"use client";

import { useEffect, useRef, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

export type Mensaje = {
  id: string;
  texto: string;
  autor_id: string;
  creado_en: string;
};

/**
 * La conversación de una reserva.
 *
 * Los mensajes nuevos llegan por dos caminos, a propósito:
 *
 *  1. Aviso en vivo de Supabase, que es instantáneo.
 *  2. Una revisión cada 4 segundos, por si el aviso en vivo no está disponible
 *     —depende de una configuración del proyecto que puede no estar activa—.
 *
 * Con los dos, el chat funciona siempre: si el primero anda, se siente
 * inmediato; si no, tarda unos segundos pero nunca se queda mudo.
 */
export default function Chat({
  reservaId,
  usuarioId,
  nombreDelOtro,
  mensajesIniciales,
}: {
  reservaId: string;
  usuarioId: string;
  nombreDelOtro: string;
  mensajesIniciales: Mensaje[];
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(mensajesIniciales);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finDeLaLista = useRef<HTMLDivElement>(null);

  // Une sin repetir: el mismo mensaje puede llegar por el aviso en vivo y por
  // la revisión periódica, y no queremos verlo dos veces.
  function agregar(nuevos: Mensaje[]) {
    setMensajes((previos) => {
      const porId = new Map(previos.map((m) => [m.id, m]));
      for (const m of nuevos) porId.set(m.id, m);
      return [...porId.values()].sort((a, b) => a.creado_en.localeCompare(b.creado_en));
    });
  }

  useEffect(() => {
    let vivo = true;
    const supabase = crearClienteNavegador();

    async function revisar() {
      const { data } = await supabase
        .from("mensajes")
        .select("id, texto, autor_id, creado_en")
        .eq("reservation_id", reservaId)
        .order("creado_en", { ascending: true });
      if (vivo && data) agregar(data as Mensaje[]);
    }

    const canal = supabase
      .channel(`mensajes-${reservaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes", filter: `reservation_id=eq.${reservaId}` },
        (aviso) => agregar([aviso.new as Mensaje])
      )
      .subscribe();

    const reloj = setInterval(revisar, 4000);

    return () => {
      vivo = false;
      clearInterval(reloj);
      supabase.removeChannel(canal);
    };
  }, [reservaId]);

  useEffect(() => {
    finDeLaLista.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes.length]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;

    setError(null);
    setEnviando(true);
    try {
      const respuesta = await fetch("/api/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservaId, texto: limpio }),
      });
      const cuerpo = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        setError(cuerpo.error ?? "No se pudo enviar el mensaje.");
        return;
      }
      agregar([cuerpo.mensaje as Mensaje]);
      setTexto("");
    } catch {
      setError("No pudimos conectarnos. Revisá tu internet e intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  const hora = (iso: string) =>
    new Intl.DateTimeFormat("es-GT", {
      hour: "numeric", minute: "2-digit", timeZone: "America/Guatemala",
    }).format(new Date(iso));

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-medium">Conversación con {nombreDelOtro}</h2>
        <p className="text-xs text-slate-500">
          Solo ustedes dos pueden leer esto. Sirve para coordinar la entrega.
        </p>
      </div>

      <div className="max-h-96 space-y-3 overflow-y-auto px-4 py-4">
        {mensajes.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Todavía no hay mensajes. Escribí el primero para coordinar dónde y a qué
            hora se encuentran.
          </p>
        ) : (
          mensajes.map((m) => {
            const esMio = m.autor_id === usuarioId;
            return (
              <div key={m.id} className={`flex ${esMio ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    esMio ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"
                  }`}
                >
                  <p className="whitespace-pre-line break-words text-sm">{m.texto}</p>
                  <p className={`mt-1 text-[11px] ${esMio ? "text-slate-300" : "text-slate-500"}`}>
                    {hora(m.creado_en)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={finDeLaLista} />
      </div>

      <form onSubmit={enviar} className="border-t border-slate-200 p-3">
        {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí un mensaje…"
            maxLength={1000}
            aria-label="Mensaje"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-base
                       outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
          <button
            type="submit"
            disabled={enviando}
            className="shrink-0 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {enviando ? "…" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
