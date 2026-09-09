import VistaCarrito from "@/components/VistaCarrito";

export const metadata = { title: "Tu carrito — Prestamo" };

export default function PaginaCarrito() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold">Tu carrito</h1>
      <p className="mt-1 text-tinta-600">
        Revisá las fechas antes de continuar. Nada queda apartado hasta que confirmes.
      </p>
      <div className="mt-6">
        <VistaCarrito />
      </div>
    </main>
  );
}
