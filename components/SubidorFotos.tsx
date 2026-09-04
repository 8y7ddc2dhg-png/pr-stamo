"use client";

import { useState } from "react";
import Image from "next/image";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { achicarImagen, validarArchivoImagen } from "@/lib/imagenes";

export type FotoSubida = { url: string; ruta: string };

/**
 * Sube fotos directo del navegador a Supabase Storage.
 *
 * No pasan por nuestro servidor. ¿Por qué? Porque pasar archivos por el
 * servidor de Vercel gasta tiempo de ejecución (que se paga) y agrega un
 * intermediario que se puede caer. Y la seguridad no se pierde: la regla de
 * Storage solo deja escribir dentro de la carpeta con el id del propio
 * usuario, así que nadie puede pisar las fotos de otro.
 */
export default function SubidorFotos({
  usuarioId,
  fotos,
  alCambiar,
  maximo = 4,
}: {
  usuarioId: string;
  fotos: FotoSubida[];
  alCambiar: (fotos: FotoSubida[]) => void;
  maximo?: number;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarArchivos(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setError(null);

    const disponibles = maximo - fotos.length;
    if (disponibles <= 0) {
      setError(`Ya subiste el máximo de ${maximo} fotos.`);
      return;
    }

    const aSubir = Array.from(lista).slice(0, disponibles);
    setSubiendo(true);
    const supabase = crearClienteNavegador();
    const nuevas: FotoSubida[] = [];

    for (const archivo of aSubir) {
      const problema = validarArchivoImagen(archivo);
      if (problema) {
        setError(problema);
        continue;
      }

      try {
        const achicada = await achicarImagen(archivo);
        // La ruta empieza con el id del usuario: eso es lo que la regla de
        // seguridad de Storage comprueba para dejar escribir.
        const ruta = `${usuarioId}/${crypto.randomUUID()}.jpg`;

        const { error: fallo } = await supabase.storage
          .from("fotos-items")
          .upload(ruta, achicada, { contentType: "image/jpeg" });

        if (fallo) {
          setError("No se pudo subir una de las fotos. Intentá de nuevo.");
          continue;
        }

        const { data } = supabase.storage.from("fotos-items").getPublicUrl(ruta);
        nuevas.push({ url: data.publicUrl, ruta });
      } catch {
        setError("No se pudo procesar una de las fotos.");
      }
    }

    alCambiar([...fotos, ...nuevas]);
    setSubiendo(false);
  }

  async function quitar(foto: FotoSubida) {
    alCambiar(fotos.filter((f) => f.ruta !== foto.ruta));
    // Se borra del almacenamiento para no dejar basura ocupando espacio.
    // Si falla, no le avisamos al usuario: ya la quitó de su publicación y el
    // archivo huérfano no le hace daño a nadie.
    const supabase = crearClienteNavegador();
    await supabase.storage.from("fotos-items").remove([foto.ruta]);
  }

  return (
    <div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fotos.map((foto, indice) => (
          <div key={foto.ruta} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200">
            <Image src={foto.url} alt={`Foto ${indice + 1}`} fill className="object-cover" sizes="200px" />
            {indice === 0 && (
              <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[11px] text-white">
                Portada
              </span>
            )}
            <button
              type="button"
              onClick={() => quitar(foto)}
              aria-label={`Quitar foto ${indice + 1}`}
              className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-sm font-medium shadow"
            >
              ✕
            </button>
          </div>
        ))}

        {fotos.length < maximo && (
          <label
            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1
                       rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500"
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={subiendo}
              onChange={(e) => {
                manejarArchivos(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="text-2xl leading-none">+</span>
            <span>{subiendo ? "Subiendo…" : "Agregar foto"}</span>
          </label>
        )}
      </div>

      <p className="mt-2 text-sm text-slate-500">
        La primera foto es la portada, la que se ve en el buscador. Hasta {maximo} fotos.
      </p>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
