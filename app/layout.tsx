import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import Encabezado from "@/components/Encabezado";

/*
  La tipografía se carga con next/font, que la descarga al COMPILAR y la sirve
  desde nuestro propio dominio. Antes usábamos solo la fuente del sistema para
  no pagar una descarga extra; el argumento sigue valiendo contra las fuentes
  externas —que además obligan al navegador a conectarse a otro servidor antes
  de poder dibujar el texto— pero no contra esta forma, que evita esa conexión.
  Se carga un solo peso variable y con `display: swap`, así el texto se ve de
  inmediato con la fuente del sistema y se reemplaza cuando la otra llega.
*/
const fuente = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--fuente-cargada",
});

export const metadata: Metadata = {
  title: "Prestamo — Rentá lo que necesitás, por los días que lo necesitás",
  description:
    "Marketplace guatemalteco para rentar herramientas, mobiliario y equipo " +
    "por días. Publicá lo que no usás todo el tiempo y sacale provecho.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#123831",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-GT" className={fuente.variable}>
      <body className="min-h-screen bg-tinta-50 text-tinta-900 antialiased">
        <Encabezado />
        {children}
      </body>
    </html>
  );
}
