import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prestamo — Rentá lo que necesitás, por los días que lo necesitás",
  description:
    "Marketplace guatemalteco para rentar herramientas, mobiliario y equipo " +
    "por días. Publicá lo que no usás todo el tiempo y sacale provecho.",
};

// "Primero el celular": esto le dice al teléfono que use su ancho real y no
// finja ser una pantalla de escritorio achicada. Sin esto, todo se ve diminuto.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // lang="es-GT" le dice al navegador y a los lectores de pantalla que el
  // contenido está en español de Guatemala.
  return (
    <html lang="es-GT">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
