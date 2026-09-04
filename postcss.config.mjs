// Tailwind 4 se conecta a Next.js a través de PostCSS. Este archivo es todo
// lo que hace falta: ya no existe tailwind.config.js como en la versión 3.
// La configuración de colores y tipografías va dentro de app/globals.css.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
