"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SubidorFotos, { type FotoSubida } from "@/components/SubidorFotos";
import { CATEGORIAS } from "@/lib/categorias";
import { CIUDADES } from "@/lib/ciudades";
import { aCentavos, formatearQuetzales } from "@/lib/dinero";

export default function FormularioPublicar({
  usuarioId,
  ciudadDelPerfil,
}: {
  usuarioId: string;
  ciudadDelPerfil: string | null;
}) {
  const router = useRouter();

  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [ciudad, setCiudad] = useState(ciudadDelPerfil ?? "");
  const [cantidad, setCantidad] = useState("1");
  const [fotos, setFotos] = useState<FotoSubida[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [faltaPerfil, setFaltaPerfil] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Vista previa del precio mientras escribe, para que vea Q125.00 y no dude
  // de si "125.5" significa Q125.50 o Q125.05.
  const centavos = aCentavos(precio);
  const precioLegible = centavos !== null ? formatearQuetzales(centavos) : null;

  async function publicar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setFaltaPerfil(false);
    setEnviando(true);

    try {
      const respuesta = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          categoria,
          descripcion,
          precio_por_dia: precio,
          ciudad,
          cantidad_disponible: Number(cantidad),
          fotos: fotos.map((f) => ({ url: f.url })),
        }),
      });

      const cuerpo = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        setError(cuerpo.error ?? "No se pudo publicar. Intentá de nuevo.");
        setFaltaPerfil(Boolean(cuerpo.faltaPerfil));
        setEnviando(false);
        return;
      }

      router.push(`/item/${cuerpo.id}`);
    } catch {
      // Sin esto, una falla de red dejaba el botón trabado en "Publicando…"
      // con todo el formulario ya lleno y sin forma de reintentar.
      setError("No pudimos conectarnos. Revisá tu internet e intentá de nuevo.");
      setEnviando(false);
    }
  }

  const claseCampo =
    "mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none " +
    "focus:border-slate-900 focus:ring-1 focus:ring-slate-900";

  return (
    <form onSubmit={publicar} className="space-y-6">
      <div>
        <label htmlFor="titulo" className="block text-sm font-medium">¿Qué estás publicando?</label>
        <input
          id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)}
          placeholder="Taladro percutor Black&amp;Decker" className={claseCampo}
        />
      </div>

      <div>
        <label htmlFor="categoria" className="block text-sm font-medium">Categoría</label>
        <select id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={claseCampo}>
          <option value="">Elegí una…</option>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="descripcion" className="block text-sm font-medium">Descripción</label>
        <textarea
          id="descripcion" rows={5} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          placeholder="En qué estado está, qué incluye, si hay algo que la persona deba saber antes de rentarlo."
          className={claseCampo}
        />
      </div>

      <div>
        <span className="block text-sm font-medium">Fotos</span>
        <SubidorFotos usuarioId={usuarioId} fotos={fotos} alCambiar={setFotos} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="precio" className="block text-sm font-medium">Precio por día</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 pt-1 text-slate-500">Q</span>
            <input
              id="precio" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)}
              placeholder="75.00" className={`${claseCampo} pl-8`}
            />
          </div>
          {precioLegible && (
            <p className="mt-1 text-sm text-slate-500">Se va a mostrar como {precioLegible} por día.</p>
          )}
        </div>

        <div>
          <label htmlFor="cantidad" className="block text-sm font-medium">¿Cuántas unidades tenés?</label>
          <input
            id="cantidad" type="number" min={1} max={999} value={cantidad}
            onChange={(e) => setCantidad(e.target.value)} className={claseCampo}
          />
          <p className="mt-1 text-sm text-slate-500">Si tenés 20 sillas iguales, poné 20.</p>
        </div>
      </div>

      <div>
        <label htmlFor="ciudad" className="block text-sm font-medium">¿Dónde se entrega?</label>
        <select id="ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={claseCampo}>
          <option value="">Elegí una…</option>
          {CIUDADES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{error}</p>
          {faltaPerfil && (
            <Link href="/mi-perfil" className="mt-1 inline-block font-medium underline">
              Ir a completar mi perfil
            </Link>
          )}
        </div>
      )}

      <button
        type="submit" disabled={enviando}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {enviando ? "Publicando…" : "Publicar"}
      </button>
    </form>
  );
}
