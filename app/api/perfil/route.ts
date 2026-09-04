import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esCiudadValida } from "@/lib/ciudades";
import { normalizarTelefono, validarNombre } from "@/lib/validaciones";

/**
 * Guardar los datos del perfil.
 *
 * Vuelve a validar TODO, aunque la pantalla ya lo haya hecho. La validación
 * del navegador es comodidad para el usuario; cualquiera puede mandar datos
 * directo acá saltándose la pantalla (ver CLAUDE.md, regla 6).
 */
export async function PUT(peticion: Request) {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás ingresar primero." }, { status: 401 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ error: "No entendimos los datos enviados." }, { status: 400 });
  }

  const { nombre, telefono_whatsapp, ciudad } = (cuerpo ?? {}) as Record<string, unknown>;

  if (typeof nombre !== "string" || typeof telefono_whatsapp !== "string" || typeof ciudad !== "string") {
    return NextResponse.json({ error: "Faltan datos del formulario." }, { status: 400 });
  }

  const errorNombre = validarNombre(nombre);
  if (errorNombre) return NextResponse.json({ error: errorNombre }, { status: 400 });

  const telefono = normalizarTelefono(telefono_whatsapp);
  if (!telefono) {
    return NextResponse.json(
      { error: "Ese número no parece de Guatemala. Son 8 dígitos, por ejemplo 5512-3456." },
      { status: 400 }
    );
  }

  if (!esCiudadValida(ciudad)) {
    return NextResponse.json({ error: "Elegí una ciudad de la lista." }, { status: 400 });
  }

  // Se actualiza filtrando por el id del usuario conectado. Aunque RLS ya lo
  // impediría, el filtro explícito deja claro en el código que nadie puede
  // editar el perfil de otro: la intención queda escrita, no solo aplicada.
  const { error } = await supabase
    .from("users")
    .update({ nombre: nombre.trim(), telefono_whatsapp: telefono, ciudad })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "No se pudo guardar. Intentá de nuevo en un momento." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
