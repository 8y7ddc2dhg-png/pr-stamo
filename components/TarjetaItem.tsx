import Link from "next/link";
import Image from "next/image";
import { formatearQuetzales } from "@/lib/dinero";

export type ItemDeCatalogo = {
  id: string;
  titulo: string;
  categoria: string;
  precio_por_dia_centavos: number;
  ciudad: string;
  cantidad_disponible: number;
  listing_photos: { url: string; orden: number }[];
};

/**
 * La tarjeta del catálogo.
 *
 * TODAS LAS IMÁGENES TIENEN EL MISMO ALTO, recortadas al centro. Es la
 * decisión que más ordena una grilla: si cada foto conservara su proporción,
 * las tarjetas quedarían de alturas distintas y la retícula se vería
 * desordenada aunque el espaciado fuera perfecto. Se pierde un pedazo de
 * algunas fotos, y vale la pena.
 *
 * La jerarquía es: foto → nombre → dónde y cuántos → precio. El precio va
 * último y más grande porque es el dato que decide, y quedar al final lo deja
 * alineado entre tarjetas vecinas.
 */
export default function TarjetaItem({ item }: { item: ItemDeCatalogo }) {
  const portada = [...item.listing_photos].sort((a, b) => a.orden - b.orden)[0];

  const disponibilidad =
    item.cantidad_disponible > 1
      ? `${item.cantidad_disponible} disponibles`
      : "Disponible";

  return (
    <Link
      href={`/item/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border-[0.5px] border-tinta-300
                 bg-white transition-shadow hover:shadow-[0_2px_12px_rgba(28,26,23,0.08)]"
    >
      <div className="relative h-[170px] shrink-0 bg-tinta-100">
        {portada ? (
          <Image
            src={portada.url}
            alt={item.titulo}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 50vw, 260px"
          />
        ) : (
          <div className="grid h-full place-items-center text-xs text-tinta-400">Sin foto</div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">{item.titulo}</h3>

        <p className="text-xs text-tinta-500">
          {item.ciudad} · {disponibilidad}
        </p>

        {/* mt-auto empuja el precio al fondo: así queda a la misma altura en
            todas las tarjetas, aunque los títulos ocupen una o dos líneas. */}
        <p className="mt-auto pt-2 text-base font-medium">
          {formatearQuetzales(item.precio_por_dia_centavos)}
          <span className="text-xs font-normal text-tinta-500"> / día</span>
        </p>
      </div>
    </Link>
  );
}
