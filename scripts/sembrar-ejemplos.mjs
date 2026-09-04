/**
 * Llena el catálogo con ítems de ejemplo, para poder probar y para tener algo
 * que mostrar en una demostración.
 *
 * CÓMO SE CORRE:    npm run sembrar
 * CÓMO SE DESHACE:  npm run sembrar:limpiar
 *
 * Crea dos cuentas de ejemplo con correos @ejemplo-prestamo.test (un dominio
 * reservado que no existe, así que nunca le va a llegar correo a nadie real),
 * genera fotos de relleno y publica ocho ítems.
 *
 * Las fotos se generan acá mismo, sin bajar nada de internet: son PNG de un
 * color por categoría. No son bonitas, pero son honestas: nadie va a confundir
 * un ejemplo con una publicación real.
 */
import { createClient } from "@supabase/supabase-js";
import zlib from "node:zlib";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DOMINIO = "ejemplo-prestamo.test";
const limpiar = process.argv.includes("--limpiar");

// ---------- generador de PNG (sin librerías) ----------
const tablaCrc = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = tablaCrc[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function generarPng(ancho, alto, [r, g, b]) {
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3);
    fila[0] = 0; // sin filtro
    // Bandas horizontales suaves, para que no se vea un bloque plano.
    const f = 0.82 + 0.18 * Math.sin((y / alto) * Math.PI * 3);
    for (let x = 0; x < ancho; x++) {
      const i = 1 + x * 3;
      fila[i] = Math.min(255, Math.round(r * f));
      fila[i + 1] = Math.min(255, Math.round(g * f));
      fila[i + 2] = Math.min(255, Math.round(b * f));
    }
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, color RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", zlib.deflateSync(Buffer.concat(filas), { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

const COLOR_POR_CATEGORIA = {
  herramientas:        [201, 122, 58],
  mobiliario_eventos:  [86, 122, 168],
  equipo_audio_video:  [104, 92, 148],
  deportes_aire_libre: [88, 148, 106],
  hogar_jardin:        [168, 132, 96],
  otros:               [128, 128, 136],
};

// ---------- los datos ----------
const CUENTAS = [
  { correo: `roble@${DOMINIO}`, nombre: "Alquileres El Roble", telefono: "55112233", ciudad: "Ciudad de Guatemala" },
  { correo: `marta@${DOMINIO}`, nombre: "Marta Xiloj",         telefono: "44556677", ciudad: "Mixco" },
];

const ITEMS = [
  { cuenta: 0, titulo: "Taladro percutor Black&Decker 1/2\"", categoria: "herramientas", precio: "75", ciudad: "Ciudad de Guatemala", cantidad: 1,
    descripcion: "Taladro percutor de 1/2 pulgada, ideal para perforar concreto y block. Incluye maletín y juego de brocas para pared y madera. Está en buen estado, se usa poco." },
  { cuenta: 0, titulo: "20 sillas plegables blancas", categoria: "mobiliario_eventos", precio: "8", ciudad: "Ciudad de Guatemala", cantidad: 20,
    descripcion: "Sillas plegables de plástico reforzado, blancas, limpias y en buen estado. El precio es por silla por día. Ideales para fiestas, reuniones o eventos pequeños." },
  { cuenta: 0, titulo: "Carpa para 50 personas 6x12m", categoria: "mobiliario_eventos", precio: "400", ciudad: "Villa Nueva", cantidad: 2,
    descripcion: "Carpa blanca de 6 por 12 metros, con estructura de tubo galvanizado. Cubre cómodamente 50 personas sentadas. El armado corre por cuenta de quien renta." },
  { cuenta: 0, titulo: "Bocina amplificada 15\" con micrófono", categoria: "equipo_audio_video", precio: "150", ciudad: "Ciudad de Guatemala", cantidad: 3,
    descripcion: "Bocina activa de 15 pulgadas con entrada para micrófono y bluetooth. Incluye un micrófono alámbrico, cable de corriente y tripié. Suena bien para hasta 100 personas." },
  { cuenta: 1, titulo: "Pulidora de piso industrial", categoria: "herramientas", precio: "200", ciudad: "Mixco", cantidad: 1,
    descripcion: "Pulidora de piso de 17 pulgadas para trabajo pesado. Sirve para pulir, encerar y lavar pisos de granito o cemento. Se entrega con dos discos." },
  { cuenta: 1, titulo: "Casa inflable para niños", categoria: "mobiliario_eventos", precio: "350", ciudad: "Santa Catarina Pinula", cantidad: 1,
    descripcion: "Inflable de 3x3 metros con resbaladero, para niños de hasta 10 años. Incluye el motor. Se necesita toma de corriente cerca y un espacio plano." },
  { cuenta: 1, titulo: "Bicicleta de montaña rodado 29", categoria: "deportes_aire_libre", precio: "60", ciudad: "Mixco", cantidad: 2,
    descripcion: "Bicicleta de montaña rodado 29, 21 velocidades, frenos de disco. Recién servicieada. Se presta con casco. Talla mediana, para personas de 1.65 a 1.80." },
  { cuenta: 1, titulo: "Proyector Full HD con pantalla de 100\"", categoria: "equipo_audio_video", precio: "180", ciudad: "Antigua Guatemala", cantidad: 1,
    descripcion: "Proyector 1080p con entrada HDMI y USB, más pantalla de trípode de 100 pulgadas. Sirve para películas al aire libre o presentaciones. Incluye cable HDMI de 5 metros." },
];

// ---------- limpieza ----------
async function borrarTodoLoSembrado() {
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const demos = (lista?.users ?? []).filter((u) => u.email?.endsWith(`@${DOMINIO}`));

  for (const u of demos) {
    const { data: archivos } = await admin.storage.from("fotos-items").list(u.id);
    if (archivos?.length) {
      await admin.storage.from("fotos-items").remove(archivos.map((a) => `${u.id}/${a.name}`));
    }
    // Las publicaciones se van solas al borrar la cuenta (on delete cascade).
    await admin.auth.admin.deleteUser(u.id);
  }
  console.log(`  Se borraron ${demos.length} cuentas de ejemplo y todo lo que colgaba de ellas.`);
}

// ---------- siembra ----------
async function sembrar() {
  await borrarTodoLoSembrado(); // arranca de cero para poder correrlo mil veces

  const ids = [];
  for (const c of CUENTAS) {
    const { data, error } = await admin.auth.admin.createUser({ email: c.correo, email_confirm: true });
    if (error) throw new Error(`No se pudo crear ${c.correo}: ${error.message}`);
    const id = data.user.id;
    await admin.from("users").update({
      nombre: c.nombre, telefono_whatsapp: c.telefono, ciudad: c.ciudad,
    }).eq("id", id);
    ids.push(id);
    console.log(`  Cuenta creada: ${c.nombre}`);
  }

  for (const item of ITEMS) {
    const usuarioId = ids[item.cuenta];

    const { data: publicacion, error } = await admin.from("listings").insert({
      user_id: usuarioId,
      titulo: item.titulo,
      categoria: item.categoria,
      descripcion: item.descripcion,
      precio_por_dia_centavos: Math.round(Number(item.precio) * 100),
      ciudad: item.ciudad,
      cantidad_disponible: item.cantidad,
    }).select("id").single();
    if (error) throw new Error(`No se pudo publicar "${item.titulo}": ${error.message}`);

    const color = COLOR_POR_CATEGORIA[item.categoria];
    for (let orden = 0; orden < 2; orden++) {
      const png = generarPng(1200, 900, color.map((v) => Math.max(0, v - orden * 22)));
      const ruta = `${usuarioId}/${crypto.randomUUID()}.png`;
      const { error: errSubida } = await admin.storage
        .from("fotos-items").upload(ruta, png, { contentType: "image/png" });
      if (errSubida) throw new Error(`No se pudo subir la foto: ${errSubida.message}`);

      const { data: publica } = admin.storage.from("fotos-items").getPublicUrl(ruta);
      await admin.from("listing_photos").insert({
        listing_id: publicacion.id, url: publica.publicUrl, orden,
      });
    }
    console.log(`  Publicado: ${item.titulo}`);
  }

  // Comprobación final: ¿lo ve alguien SIN cuenta?
  const publico = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data: visibles, error: errPublico } = await publico
    .from("listings").select("id, titulo, listing_photos(url)").eq("activo", true);

  console.log("");
  if (errPublico) {
    console.log(`  FALLA: un visitante no puede leer el catálogo: ${errPublico.message}`);
    process.exit(1);
  }
  const sinFoto = (visibles ?? []).filter((v) => (v.listing_photos?.length ?? 0) === 0);
  console.log(`  ${visibles.length} ítems visibles para alguien sin cuenta.`);
  console.log(`  ${sinFoto.length} de ellos sin foto (deberían ser 0).`);
  if (visibles.length !== ITEMS.length || sinFoto.length > 0) process.exit(1);
}

if (limpiar) {
  await borrarTodoLoSembrado();
} else {
  await sembrar();
}
