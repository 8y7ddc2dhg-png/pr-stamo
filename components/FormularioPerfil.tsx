"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CIUDADES } from "@/lib/ciudades";
import { validarNombre, validarTelefono } from "@/lib/validaciones";
import type { Usuario } from "@/lib/tipos";

export default function FormularioPerfil({ perfil }: { perfil: Usuario }) {
  const router = useRouter();

  const [nombre, setNombre] = useState(perfil.nombre ?? "");
  const [telefono, setTelefono] = useState(perfil.telefono_whatsapp ?? "");
  const [ciudad, setCiudad] = useState(perfil.ciudad ?? "");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<"listo" | "guardando" | "guardado">("listo");

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();

    // Se valida acá para dar respuesta inmediata, pero el servidor vuelve a
    // validar todo. Lo del navegador es comodidad; lo del servidor es la ley.
    const nuevos: Record<string, string> = {};
    const errNombre = validarNombre(nombre);
    const errTelefono = validarTelefono(telefono);
    if (errNombre) nuevos.nombre = errNombre;
    if (errTelefono) nuevos.telefono = errTelefono;
    if (!ciudad) nuevos.ciudad = "Elegí tu ciudad.";

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setEstado("guardando");
    const respuesta = await fetch("/api/perfil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, telefono_whatsapp: telefono, ciudad }),
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      setErrores({ general: cuerpo.error ?? "No se pudo guardar. Intentá de nuevo." });
      setEstado("listo");
      return;
    }

    setEstado("guardado");
    router.refresh();
  }

  const claseCampo =
    "mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none " +
    "focus:border-slate-900 focus:ring-1 focus:ring-slate-900";

  return (
    <form onSubmit={guardar} className="space-y-6">
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium">
          Tu nombre o el de tu negocio
        </label>
        <input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="María López / Alquileres El Roble"
          className={claseCampo}
        />
        <p className="mt-1 text-sm text-slate-500">
          Es lo que van a ver los demás en tus publicaciones.
        </p>
        {errores.nombre && <p className="mt-1 text-sm text-red-700">{errores.nombre}</p>}
      </div>

      <div>
        <label htmlFor="telefono" className="block text-sm font-medium">
          Tu WhatsApp
        </label>
        <input
          id="telefono"
          type="tel"
          inputMode="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="5512-3456"
          className={claseCampo}
        />
        <p className="mt-1 text-sm text-slate-500">
          Solo se lo mostramos a la otra persona cuando una reserva ya está
          confirmada, para que coordinen la entrega. No aparece en tu perfil público.
        </p>
        {errores.telefono && <p className="mt-1 text-sm text-red-700">{errores.telefono}</p>}
      </div>

      <div>
        <label htmlFor="ciudad" className="block text-sm font-medium">
          Tu ciudad
        </label>
        <select
          id="ciudad"
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
          className={claseCampo}
        >
          <option value="">Elegí una…</option>
          {CIUDADES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {errores.ciudad && <p className="mt-1 text-sm text-red-700">{errores.ciudad}</p>}
      </div>

      {errores.general && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{errores.general}</p>
      )}

      <button
        type="submit"
        disabled={estado === "guardando"}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {estado === "guardando" ? "Guardando…" : "Guardar"}
      </button>

      {estado === "guardado" && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Listo, tus datos quedaron guardados.
        </p>
      )}
    </form>
  );
}
