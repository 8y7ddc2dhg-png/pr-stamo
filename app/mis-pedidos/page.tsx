import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearQuetzales } from "@/lib/dinero";
import { formatearRango, formatearFecha } from "@/lib/fechas";

export const metadata = { title: "Mis pedidos — Prestamo" };

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  solicitada:   { texto: "Esperando respuesta", clase: "bg-tinta-100 text-tinta-700" },
  aceptada:     { texto: "Falta pagar",          clase: "bg-amber-100 text-amber-900" },
  rechazada:    { texto: "Rechazada",            clase: "bg-tinta-100 text-tinta-500" },
  pagada:       { texto: "Pagada",               clase: "bg-marca-100 text-marca-900" },
  entregada:    { texto: "Entregada",            clase: "bg-blue-100 text-blue-900" },
  devuelta:     { texto: "Devuelta",             clase: "bg-tinta-100 text-tinta-700" },
  con_problema: { texto: "Con un problema",      clase: "bg-red-100 text-red-900" },
  cancelada:    { texto: "Cancelada",            clase: "bg-tinta-100 text-tinta-500" },
};

export default async function MisPedidos({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { nuevo } = await searchParams;
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?volver_a=/mis-pedidos");

  const { data } = await supabase
    .from("pedidos")
    .select(`id, creado_en, tipo_entrega, direccion, zona, total_centavos, publicador_id,
             reservations ( id, inicio_en, fin_en, dias, precio_total_centavos, estado,
                            listings ( id, titulo, listing_photos ( url, orden ) ) )`)
    .eq("renter_id", user.id)
    .order("creado_en", { ascending: false });

  const pedidos = data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold">Mis pedidos</h1>
      <p className="mt-1 text-tinta-600">
        Lo que compraste desde el carrito.{" "}
        <Link href="/mis-reservas" className="underline">Ver reservas sueltas</Link>
      </p>

      {nuevo && (
        <p className="mt-4 rounded-xl bg-marca-50 px-4 py-3 text-sm text-marca-900">
          Listo, tu pedido quedó confirmado.
        </p>
      )}

      {pedidos.length === 0 ? (
        <div className="mt-8 rounded-xl border-[0.5px] border-dashed border-tinta-300 bg-white px-6 py-14 text-center">
          <p className="font-medium">Todavía no hiciste ningún pedido.</p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-marca-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-marca-900"
          >
            Ver el catálogo
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {pedidos.map((pedido) => {
            const reservas = Array.isArray(pedido.reservations) ? pedido.reservations : [];
            return (
              <li key={pedido.id} className="overflow-hidden rounded-xl border-[0.5px] border-tinta-200 bg-white">
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-tinta-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      Pedido del {formatearFecha(String(pedido.creado_en).slice(0, 10))}
                    </p>
                    <p className="text-xs text-tinta-500">
                      {pedido.tipo_entrega === "domicilio"
                        ? `A domicilio · ${pedido.direccion ?? ""}${pedido.zona ? `, ${pedido.zona}` : ""}`
                        : "Se recoge con el dueño"}
                    </p>
                  </div>
                  <p className="font-semibold">{formatearQuetzales(pedido.total_centavos)}</p>
                </header>

                <ul className="divide-y divide-tinta-200">
                  {reservas.map((r) => {
                    const item = Array.isArray(r.listings) ? r.listings[0] : r.listings;
                    const portada = [...(item?.listing_photos ?? [])].sort((a, b) => a.orden - b.orden)[0];
                    const estado = ESTADOS[r.estado] ?? { texto: r.estado, clase: "bg-tinta-100 text-tinta-700" };
                    return (
                      <li key={r.id}>
                        <Link href={`/reserva/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-tinta-50">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-tinta-100">
                            {portada && <Image src={portada.url} alt="" fill className="object-cover" sizes="56px" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{item?.titulo ?? "Ítem"}</p>
                            <p className="text-sm text-tinta-500">
                              {formatearRango(r.inicio_en, r.fin_en)} · {r.dias}{" "}
                              {r.dias === 1 ? "día" : "días"} · {formatearQuetzales(r.precio_total_centavos)}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${estado.clase}`}>
                            {estado.texto}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
