import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearQuetzales } from "@/lib/dinero";
import { formatearRango } from "@/lib/fechas";
import BotonPagar from "@/components/BotonPagar";

export const metadata = { title: "Mis reservas — Prestamo" };

/** Cómo se le muestra cada estado a una persona, no a un programador. */
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  solicitada:   { texto: "Esperando respuesta", clase: "bg-slate-100 text-slate-700" },
  aceptada:     { texto: "Falta pagar",          clase: "bg-amber-100 text-amber-900" },
  rechazada:    { texto: "Rechazada",            clase: "bg-slate-100 text-slate-500" },
  pagada:       { texto: "Pagada",               clase: "bg-green-100 text-green-900" },
  entregada:    { texto: "En tu poder",          clase: "bg-blue-100 text-blue-900" },
  devuelta:     { texto: "Devuelta",             clase: "bg-slate-100 text-slate-700" },
  con_problema: { texto: "Con un problema",      clase: "bg-red-100 text-red-900" },
  cancelada:    { texto: "Cancelada",            clase: "bg-slate-100 text-slate-500" },
};

export default async function MisReservas({
  searchParams,
}: {
  searchParams: Promise<{ nueva?: string }>;
}) {
  const { nueva } = await searchParams;
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?volver_a=/mis-reservas");

  const { data } = await supabase
    .from("reservations")
    .select(`id, inicio_en, fin_en, dias, precio_total_centavos, estado, creado_en,
             listings ( id, titulo, ciudad, listing_photos ( url, orden ) ),
             payments ( metodo_simulado )`)
    .eq("renter_id", user.id)
    .order("creado_en", { ascending: false });

  const reservas = data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Mis reservas</h1>

      {nueva && (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-900">
          Tu reserva quedó hecha. Ahora podés pagarla.
        </p>
      )}

      {reservas.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
          <p className="font-medium">Todavía no reservaste nada.</p>
          <Link href="/" className="mt-4 inline-block rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white">
            Ver el catálogo
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {reservas.map((r) => {
            // Supabase devuelve las relaciones como objeto o arreglo según el
            // caso; se normaliza acá para que la pantalla no tenga que saberlo.
            const item = Array.isArray(r.listings) ? r.listings[0] : r.listings;
            const pago = Array.isArray(r.payments) ? r.payments[0] : r.payments;
            const portada = [...(item?.listing_photos ?? [])].sort((a, b) => a.orden - b.orden)[0];
            const estado = ESTADOS[r.estado] ?? { texto: r.estado, clase: "bg-slate-100 text-slate-700" };

            return (
              <li key={r.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {portada && <Image src={portada.url} alt="" fill className="object-cover" sizes="80px" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link href={`/item/${item?.id}`} className="font-medium hover:underline">
                        {item?.titulo ?? "Ítem"}
                      </Link>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${estado.clase}`}>
                        {estado.texto}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      {formatearRango(r.inicio_en, r.fin_en)} · {r.dias} {r.dias === 1 ? "día" : "días"}
                    </p>
                    <p className="mt-0.5 font-semibold">{formatearQuetzales(r.precio_total_centavos)}</p>

                    {pago?.metodo_simulado && (
                      <p className="mt-1 text-xs text-slate-500">
                        Pagado {pago.metodo_simulado === "efectivo" ? "en efectivo" : "en línea"} · simulado
                      </p>
                    )}
                  </div>
                </div>

                {r.estado === "aceptada" && (
                  <div className="mt-3 flex justify-end">
                    <BotonPagar reservaId={r.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
