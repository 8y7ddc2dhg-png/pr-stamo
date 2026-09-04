import Link from "next/link";
import Image from "next/image";
import { formatearQuetzales } from "@/lib/dinero";
import { etiquetaDeCategoria } from "@/lib/categorias";

export type ItemDeCatalogo = {
  id: string;
  titulo: string;
  categoria: string;
  precio_por_dia_centavos: number;
  ciudad: string;
  listing_photos: { url: string; orden: number }[];
};

export default function TarjetaItem({ item }: { item: ItemDeCatalogo }) {
  // La portada es la foto de orden 0. Se ordena acá por si vinieran desordenadas.
  const portada = [...item.listing_photos].sort((a, b) => a.orden - b.orden)[0];

  return (
    <Link
      href={`/item/${item.id}`}
      className="group block overflow-hidden rounded-xl border border-slate-200 transition hover:border-slate-400"
    >
      <div className="relative aspect-[4/3] bg-slate-100">
        {portada ? (
          <Image
            src={portada.url}
            alt={item.titulo}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 300px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Sin foto
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-xs text-slate-500">{etiquetaDeCategoria(item.categoria)}</p>
        <h3 className="mt-0.5 line-clamp-2 font-medium leading-snug">{item.titulo}</h3>
        <p className="mt-1 font-semibold">
          {formatearQuetzales(item.precio_por_dia_centavos)}
          <span className="font-normal text-slate-500"> / día</span>
        </p>
        <p className="mt-0.5 text-sm text-slate-500">{item.ciudad}</p>
      </div>
    </Link>
  );
}
