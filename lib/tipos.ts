/**
 * Las formas de los datos que viajan entre la base de datos y las pantallas.
 *
 * Tenerlos escritos acá hace que TypeScript avise si alguien escribe
 * `usuario.telefono` cuando la columna se llama `telefono_whatsapp`, en vez de
 * que aparezca "undefined" en pantalla y nadie sepa por qué.
 */
import type { Categoria } from "@/lib/categorias";

/** El perfil completo. Solo lo ve su dueño y los administradores. */
export type Usuario = {
  id: string;
  correo: string;
  nombre: string | null;
  telefono_whatsapp: string | null;
  ciudad: string | null;
  foto_url: string | null;
  es_admin: boolean;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  nombre_titular: string | null;
  creado_en: string;
};

/**
 * Lo que cualquiera puede ver de otra persona. Viene de la vista
 * `perfiles_publicos`, no de la tabla `users`.
 * Si algún día alguien agrega el teléfono acá, se estaría publicando.
 */
export type PerfilPublico = {
  id: string;
  nombre: string | null;
  ciudad: string | null;
  foto_url: string | null;
};

export type Listing = {
  id: string;
  user_id: string;
  titulo: string;
  categoria: Categoria;
  descripcion: string;
  precio_por_dia_centavos: number;
  ciudad: string;
  cantidad_disponible: number;
  activo: boolean;
  creado_en: string;
};

export type FotoListing = {
  id: string;
  listing_id: string;
  url: string;
  orden: number;
};

/** Un ítem tal como se muestra en el catálogo: con su primera foto y su dueño. */
export type ListingParaCatalogo = Listing & {
  listing_photos: Pick<FotoListing, "url" | "orden">[];
  perfiles_publicos: PerfilPublico | null;
};
