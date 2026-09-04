/**
 * Crea un usuario de prueba y devuelve su sesión lista para inyectar en un
 * navegador. Sirve para reproducir errores que solo pasan con sesión iniciada,
 * sin depender de que llegue un correo.
 *
 * CÓMO SE CORRE:   npm run sesion:prueba
 *
 * La salida trae el nombre y el valor de la cookie que guarda la sesión.
 * Es un usuario descartable con correo @ejemplo-prestamo.test; se borra con
 * npm run sembrar:limpiar junto con los demás datos de ejemplo.
 */
import { createClient } from "@supabase/supabase-js";

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_SUPA, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const correo = `depuracion-${Date.now()}@ejemplo-prestamo.test`;
const clave = `Depuracion-${crypto.randomUUID()}`;

const { data, error } = await admin.auth.admin.createUser({
  email: correo, password: clave, email_confirm: true,
});
if (error) throw error;

await admin.from("users").update({
  nombre: "Usuario de depuración", telefono_whatsapp: "55990011", ciudad: "Mixco",
}).eq("id", data.user.id);

const anon = createClient(URL_SUPA, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { data: sesion, error: e2 } = await anon.auth.signInWithPassword({ email: correo, password: clave });
if (e2) throw e2;

const ref = new URL(URL_SUPA).hostname.split(".")[0];
console.log(JSON.stringify({
  usuarioId: data.user.id,
  correo,
  nombreCookie: `sb-${ref}-auth-token`,
  valorCookie: "base64-" + Buffer.from(JSON.stringify(sesion.session)).toString("base64"),
}));
