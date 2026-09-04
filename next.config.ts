import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las fotos de los ítems viven en Supabase Storage. Next.js solo optimiza
  // imágenes de dominios que le autoricemos explícitamente; sin esto, las
  // fotos no cargarían. El dominio exacto se agrega en la Fase 1, cuando ya
  // exista el proyecto de Supabase.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
