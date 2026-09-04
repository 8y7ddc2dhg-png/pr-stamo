import type { NextConfig } from "next";

/**
 * Next.js solo optimiza imágenes de dominios autorizados explícitamente.
 * Sin esto, las fotos de los ítems no cargarían.
 *
 * El dominio se deduce de la variable de entorno en vez de escribirlo a mano,
 * para que funcione igual en tu computadora y en Vercel sin tener que
 * acordarse de cambiarlo en dos lugares.
 */
const hostDeSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: hostDeSupabase
      ? [
          {
            protocol: "https",
            hostname: hostDeSupabase,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
