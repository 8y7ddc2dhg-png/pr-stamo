/**
 * Configuración de ESLint.
 *
 * ESLint revisa el estilo y los errores comunes del código sin ejecutarlo.
 * `eslint-config-next` trae las reglas que Next.js recomienda, ya listas.
 *
 * Nota: se importan directamente porque la versión 16 ya usa el formato
 * moderno de ESLint ("flat config"). No hace falta el adaptador FlatCompat
 * que se ve en tutoriales viejos.
 */
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const configuracion = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default configuracion;
