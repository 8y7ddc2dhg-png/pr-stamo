import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esCategoriaValida } from "@/lib/categorias";
import { esCiudadValida } from "@/lib/ciudades";
import { aCentavos } from "@/lib/dinero";

/**
 * Crear una publicación.
 *
 * Valida todo de nuevo en el servidor y, sobre todo, usa el id del usuario de
 * la SESIÓN — nunca el que venga en el cuerpo de la petición. Si confiáramos en
 * lo que manda el navegador, cualquiera podría publicar a nombre de otro.
 */
export async function POST(peticion: Request) {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás ingresar primero." }, { status: 401 });
  }

  // Sin nombre y teléfono no se puede publicar: quien rente necesita saber con
  // quién trata y cómo coordinar la entrega.
  const { data: perfil } = await supabase
    .from("users")
    .select("nombre, telefono_whatsapp, ciudad")
    .eq("id", user.id)
    .single();

  if (!perfil?.nombre || !perfil?.telefono_whatsapp) {
    return NextResponse.json(
      { error: "Antes de publicar, completá tu nombre y WhatsApp en Mi perfil.", faltaPerfil: true },
      { status: 400 }
    );
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await peticion.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "No entendimos los datos enviados." }, { status: 400 });
  }

  const titulo = String(cuerpo.titulo ?? "").trim();
  const descripcion = String(cuerpo.descripcion ?? "").trim();
  const categoria = String(cuerpo.categoria ?? "");
  const ciudad = String(cuerpo.ciudad ?? "");
  const cantidad = Number(cuerpo.cantidad_disponible ?? 1);
  const fotos = Array.isArray(cuerpo.fotos) ? (cuerpo.fotos as { url: string }[]) : [];

  if (titulo.length < 3 || titulo.length > 120)
    return NextResponse.json({ error: "El título tiene que tener entre 3 y 120 letras." }, { status: 400 });

  if (descripcion.length < 10 || descripcion.length > 2000)
    return NextResponse.json({ error: "Contá un poco más: la descripción necesita al menos 10 letras." }, { status: 400 });

  if (!esCategoriaValida(categoria))
    return NextResponse.json({ error: "Elegí una categoría de la lista." }, { status: 400 });

  if (!esCiudadValida(ciudad))
    return NextResponse.json({ error: "Elegí una ciudad de la lista." }, { status: 400 });

  const precioCentavos = aCentavos(String(cuerpo.precio_por_dia ?? ""));
  if (precioCentavos === null || precioCentavos < 100 || precioCentavos > 5000000)
    return NextResponse.json({ error: "Poné un precio por día entre Q1.00 y Q50,000.00." }, { status: 400 });

  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999)
    return NextResponse.json({ error: "La cantidad tiene que ser un número entre 1 y 999." }, { status: 400 });

  if (fotos.length === 0)
    return NextResponse.json({ error: "Subí al menos una foto. Sin foto casi nadie se anima a rentar." }, { status: 400 });

  const { data: publicacion, error } = await supabase
    .from("listings")
    .insert({
      user_id: user.id, // de la sesión, no del cuerpo de la petición
      titulo,
      categoria,
      descripcion,
      precio_por_dia_centavos: precioCentavos,
      ciudad,
      cantidad_disponible: cantidad,
    })
    .select("id")
    .single();

  if (error || !publicacion) {
    return NextResponse.json({ error: "No se pudo publicar. Intentá de nuevo." }, { status: 500 });
  }

  const filasFotos = fotos
    .filter((f) => typeof f?.url === "string")
    .slice(0, 4)
    .map((f, orden) => ({ listing_id: publicacion.id, url: f.url, orden }));

  const { error: errorFotos } = await supabase.from("listing_photos").insert(filasFotos);

  if (errorFotos) {
    // La publicación ya existe pero se quedó sin fotos, y un ítem sin foto en
    // el catálogo se ve roto. Se DESPUBLICA (activo = false) en vez de
    // borrarse: RLS no permite borrar publicaciones —decisión de la migración
    // 0002, para no romper historiales— así que un delete acá fallaría en
    // silencio y el ítem a medias quedaría visible igual.
    await supabase.from("listings").update({ activo: false }).eq("id", publicacion.id);
    return NextResponse.json({ error: "No se pudieron guardar las fotos. Intentá de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: publicacion.id });
}
