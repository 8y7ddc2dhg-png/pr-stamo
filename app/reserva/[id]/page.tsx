import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearQuetzales } from "@/lib/dinero";
import { formatearRango } from "@/lib/fechas";
import { formatearTelefono } from "@/lib/validaciones";
import Chat, { type Mensaje } from "@/components/Chat";
import BotonPagar from "@/components/BotonPagar";

export const metadata = { title: "Reserva — Prestamo" };

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  solicitada:   { texto: "Esperando respuesta", clase: "bg-slate-100 text-slate-700" },
  aceptada:     { texto: "Falta pagar",          clase: "bg-amber-100 text-amber-900" },
  rechazada:    { texto: "Rechazada",            clase: "bg-slate-100 text-slate-500" },
  pagada:       { texto: "Pagada",               clase: "bg-green-100 text-green-900" },
  entregada:    { texto: "Entregada",            clase: "bg-blue-100 text-blue-900" },
  devuelta:     { texto: "Devuelta",             clase: "bg-slate-100 text-slate-700" },
  con_problema: { texto: "Con un problema",      clase: "bg-red-100 text-red-900" },
  cancelada:    { texto: "Cancelada",            clase: "bg-slate-100 text-slate-500" },
};

export default async function PaginaReserva({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/ingresar?volver_a=/reserva/${id}`);

  // RLS ya limita esto a las dos partes: si alguien más pide esta dirección,
  // no le devuelve nada y cae en "no encontrado". Es la respuesta correcta —
  // decirle "no tenés permiso" ya le confirmaría que la reserva existe.
  const { data } = await supabase
    .from("reservations")
    .select(`id, inicio_en, fin_en, dias, precio_total_centavos, estado,
             renter_id,
             listings ( id, titulo, ciudad, user_id, listing_photos ( url, orden ) ),
             payments ( metodo_simulado, creado_en )`)
    .eq("id", id)
    .single();

  if (!data) notFound();

  const item = Array.isArray(data.listings) ? data.listings[0] : data.listings;
  const pago = Array.isArray(data.payments) ? data.payments[0] : data.payments;
  const portada = [...(item?.listing_photos ?? [])].sort((a, b) => a.orden - b.orden)[0];

  const soyElQueRenta = data.renter_id === user.id;
  const idDelOtro = soyElQueRenta ? item?.user_id : data.renter_id;

  // El teléfono de la otra persona se revela SOLO acá, y solo porque ya hay una
  // reserva aceptada de por medio. En el catálogo nunca aparece: si fuera
  // público, la plataforma sería un directorio y todos coordinarían por fuera.
  //
  // Se pide a la vista `contactos_de_reserva` y no a la tabla `users`, porque
  // `users` solo se puede leer a uno mismo —ahí viven el correo y los datos
  // bancarios—. La vista expone únicamente nombre y teléfono, y solo a las dos
  // partes de esta reserva.
  const { data: otro } = await supabase
    .from("contactos_de_reserva")
    .select("nombre, telefono_whatsapp")
    .eq("reservation_id", id)
    .eq("usuario_id", idDelOtro)
    .maybeSingle();

  // Si la reserva todavía no fue aceptada, la vista no devuelve nada y el
  // teléfono no se muestra. El nombre sí, que es público.
  const { data: publicoDelOtro } = await supabase
    .from("perfiles_publicos").select("nombre").eq("id", idDelOtro).maybeSingle();

  const nombreDelOtro = otro?.nombre ?? publicoDelOtro?.nombre ?? "la otra persona";

  const { data: mensajes } = await supabase
    .from("mensajes")
    .select("id, texto, autor_id, creado_en")
    .eq("reservation_id", id)
    .order("creado_en", { ascending: true });

  const estado = ESTADOS[data.estado] ?? { texto: data.estado, clase: "bg-slate-100 text-slate-700" };

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link href={soyElQueRenta ? "/mis-reservas" : "/mis-publicaciones"}
            className="text-sm text-slate-500 hover:underline">
        ← Volver
      </Link>

      <div className="mt-4 flex items-start gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {portada && <Image src={portada.url} alt="" fill className="object-cover" sizes="96px" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={`/item/${item?.id}`} className="text-lg font-semibold hover:underline">
              {item?.titulo}
            </Link>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${estado.clase}`}>
              {estado.texto}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {formatearRango(data.inicio_en, data.fin_en)} · {data.dias}{" "}
            {data.dias === 1 ? "día" : "días"} · {item?.ciudad}
          </p>
          <p className="mt-1 text-lg font-semibold">
            {formatearQuetzales(data.precio_total_centavos)}
          </p>
          {pago?.metodo_simulado && (
            <p className="mt-1 text-xs text-slate-500">
              Pagado {pago.metodo_simulado === "efectivo" ? "en efectivo" : "en línea"} · simulado
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <p>
          <span className="text-slate-600">
            {soyElQueRenta ? "Le rentás a" : "Te renta"}:
          </span>{" "}
          <strong>{nombreDelOtro}</strong>
        </p>
        {otro?.telefono_whatsapp && (
          <p className="mt-1">
            <span className="text-slate-600">WhatsApp:</span>{" "}
            <a
              href={`https://wa.me/502${otro.telefono_whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              {formatearTelefono(otro.telefono_whatsapp)}
            </a>
          </p>
        )}
      </div>

      {soyElQueRenta && data.estado === "aceptada" && (
        <div className="mt-5 flex justify-end">
          <BotonPagar reservaId={data.id} />
        </div>
      )}

      <div className="mt-8">
        <Chat
          reservaId={data.id}
          usuarioId={user.id}
          nombreDelOtro={nombreDelOtro}
          mensajesIniciales={(mensajes ?? []) as Mensaje[]}
        />
      </div>
    </main>
  );
}
