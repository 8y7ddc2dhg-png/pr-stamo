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
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { borrarUsuariosDemo } from "./limpiar-demo.mjs";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DOMINIO = "ejemplo-prestamo.test";

// Si existe una foto real con el nombre del ítem, se usa esa. Si no, se genera
// un relleno de color. Así el sembrador funciona con cero fotos, con ocho, o
// con las veinte, y el catálogo mejora a medida que se van agregando.
const CARPETA_FOTOS = path.join(process.cwd(), "fotos-demo");
const EXTENSIONES = [".jpg", ".jpeg", ".png", ".webp"];

function buscarFotoReal(slug) {
  for (const ext of EXTENSIONES) {
    const ruta = path.join(CARPETA_FOTOS, slug + ext);
    if (fs.existsSync(ruta)) return ruta;
  }
  return null;
}

/**
 * Achica la foto antes de subirla, igual que hace el navegador cuando alguien
 * publica desde la app. Una foto de Unsplash puede pesar 6 MB, y el bucket
 * rechaza cualquier cosa arriba de 5 MB.
 *
 * `sips` viene incluido en macOS, así que no hay que instalar nada.
 */
function achicarConSips(rutaOriginal) {
  const destino = path.join(os.tmpdir(), `prestamo-${crypto.randomUUID()}.jpg`);
  try {
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "80",
                          "-Z", "1600", rutaOriginal, "--out", destino],
                 { stdio: "ignore" });
    return fs.readFileSync(destino);
  } catch {
    return null; // si sips falla, se cae al relleno generado
  } finally {
    try { fs.unlinkSync(destino); } catch {}
  }
}
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
  ropa:                [166, 96, 122],
  electronicos:        [72, 118, 132],
  otros:               [128, 128, 136],
};

// ---------- los datos ----------
const CUENTAS = [
  { correo: `roble@${DOMINIO}`, nombre: "Alquileres El Roble", telefono: "55112233", ciudad: "Ciudad de Guatemala" },
  { correo: `marta@${DOMINIO}`, nombre: "Marta Xiloj",         telefono: "44556677", ciudad: "Mixco" },
];

const ITEMS = [
  // --- Herramientas ---
  { cuenta: 0, slug: "taladro", titulo: "Taladro percutor Black&Decker 1/2\"", categoria: "herramientas", precio: "75", ciudad: "Ciudad de Guatemala", cantidad: 1,
    descripcion: "Taladro percutor de 1/2 pulgada, ideal para perforar concreto y block. Incluye maletín y juego de brocas para pared y madera. Está en buen estado, se usa poco." },
  { cuenta: 1, slug: "pulidora", titulo: "Pulidora de piso industrial", categoria: "herramientas", precio: "200", ciudad: "Mixco", cantidad: 1,
    descripcion: "Pulidora de piso de 17 pulgadas para trabajo pesado. Sirve para pulir, encerar y lavar pisos de granito o cemento. Se entrega con dos discos." },
  { cuenta: 0, slug: "andamio", titulo: "Andamio de dos cuerpos con plataforma", categoria: "herramientas", precio: "120", ciudad: "Villa Nueva", cantidad: 4,
    descripcion: "Andamio metálico de dos cuerpos, con plataforma de madera y ruedas. Alcanza unos 3 metros de altura. El precio es por cuerpo por día." },

  // --- Mobiliario para eventos ---
  { cuenta: 0, slug: "sillas", titulo: "20 sillas plegables blancas", categoria: "mobiliario_eventos", precio: "8", ciudad: "Ciudad de Guatemala", cantidad: 20,
    descripcion: "Sillas plegables de plástico reforzado, blancas, limpias y en buen estado. El precio es por silla por día. Ideales para fiestas, reuniones o eventos pequeños." },
  { cuenta: 0, slug: "carpa", titulo: "Carpa para 50 personas 6x12m", categoria: "mobiliario_eventos", precio: "400", ciudad: "Villa Nueva", cantidad: 2,
    descripcion: "Carpa blanca de 6 por 12 metros, con estructura de tubo galvanizado. Cubre cómodamente 50 personas sentadas. El armado corre por cuenta de quien renta." },
  { cuenta: 1, slug: "inflable", titulo: "Casa inflable para niños", categoria: "mobiliario_eventos", precio: "350", ciudad: "Santa Catarina Pinula", cantidad: 1,
    descripcion: "Inflable de 3x3 metros con resbaladero, para niños de hasta 10 años. Incluye el motor. Se necesita toma de corriente cerca y un espacio plano." },

  // --- Audio y video ---
  { cuenta: 0, slug: "bocina", titulo: "Bocina amplificada 15\" con micrófono", categoria: "equipo_audio_video", precio: "150", ciudad: "Ciudad de Guatemala", cantidad: 3,
    descripcion: "Bocina activa de 15 pulgadas con entrada para micrófono y bluetooth. Incluye un micrófono alámbrico, cable de corriente y tripié. Suena bien para hasta 100 personas." },
  { cuenta: 1, slug: "proyector", titulo: "Proyector Full HD con pantalla de 100\"", categoria: "equipo_audio_video", precio: "180", ciudad: "Antigua Guatemala", cantidad: 1,
    descripcion: "Proyector 1080p con entrada HDMI y USB, más pantalla de trípode de 100 pulgadas. Sirve para películas al aire libre o presentaciones. Incluye cable HDMI de 5 metros." },
  { cuenta: 1, slug: "luces", titulo: "Kit de luces LED para escenario", categoria: "equipo_audio_video", precio: "220", ciudad: "Mixco", cantidad: 2,
    descripcion: "Cuatro reflectores LED RGB con control DMX y trípodes. Cambian de color al ritmo de la música o se programan. Ideales para fiestas y presentaciones." },

  // --- Deportes y aire libre ---
  { cuenta: 1, slug: "bicicleta", titulo: "Bicicleta de montaña rodado 29", categoria: "deportes_aire_libre", precio: "60", ciudad: "Mixco", cantidad: 2,
    descripcion: "Bicicleta de montaña rodado 29, 21 velocidades, frenos de disco. Recién servicieada. Se presta con casco. Talla mediana, para personas de 1.65 a 1.80." },
  { cuenta: 0, slug: "campana", titulo: "Casa de campaña para 4 personas", categoria: "deportes_aire_libre", precio: "90", ciudad: "Ciudad de Guatemala", cantidad: 3,
    descripcion: "Casa de campaña impermeable para 4 personas, con doble techo y mosquitero. Se arma en diez minutos. Incluye estacas, vientos y bolsa de carga." },
  { cuenta: 1, slug: "paddle", titulo: "Tabla de paddle inflable con remo", categoria: "deportes_aire_libre", precio: "130", ciudad: "Antigua Guatemala", cantidad: 2,
    descripcion: "Tabla de paddle surf inflable de 10 pies, con remo ajustable, bomba de aire, correa de seguridad y mochila. Perfecta para el lago de Amatitlán o Atitlán." },

  // --- Hogar y jardín ---
  { cuenta: 0, slug: "hidrolavadora", titulo: "Hidrolavadora a presión 2000 PSI", categoria: "hogar_jardin", precio: "140", ciudad: "Villa Nueva", cantidad: 1,
    descripcion: "Hidrolavadora eléctrica de 2000 PSI con cuatro boquillas. Sirve para lavar carros, patios, paredes y muebles de jardín. Incluye manguera de 8 metros." },
  { cuenta: 1, slug: "cortadora", titulo: "Cortadora de grama a gasolina", categoria: "hogar_jardin", precio: "110", ciudad: "San José Pinula", cantidad: 1,
    descripcion: "Cortadora de grama autopropulsada a gasolina, con bolsa recolectora y altura de corte regulable. Se entrega con el tanque lleno." },

  // --- Ropa y trajes ---
  { cuenta: 0, slug: "vestido", titulo: "Vestido largo de fiesta talla M", categoria: "ropa", precio: "250", ciudad: "Ciudad de Guatemala", cantidad: 1,
    descripcion: "Vestido largo de gala en azul noche, talla M, con pedrería en el escote. Usado una sola vez y recién lavado en tintorería. Se entrega en funda." },
  { cuenta: 0, slug: "traje", titulo: "Traje formal de hombre talla 40", categoria: "ropa", precio: "300", ciudad: "Ciudad de Guatemala", cantidad: 1,
    descripcion: "Traje de dos piezas en gris oxford, talla 40, con camisa blanca y corbata. Ideal para una boda o una graduación. Recién salido de tintorería." },
  { cuenta: 1, slug: "tipico", titulo: "Traje típico para presentación escolar", categoria: "ropa", precio: "120", ciudad: "Antigua Guatemala", cantidad: 4,
    descripcion: "Trajes típicos completos para niño y niña, tallas de 6 a 12 años. Para actos cívicos y presentaciones del 15 de septiembre. Güipil, corte y faja." },

  // --- Electrónicos ---
  { cuenta: 1, slug: "consola", titulo: "Consola PlayStation 5 con dos controles", categoria: "electronicos", precio: "220", ciudad: "Ciudad de Guatemala", cantidad: 2,
    descripcion: "PlayStation 5 con dos controles inalámbricos, todos los cables y tres juegos instalados. Perfecta para un fin de semana o una fiesta de cumpleaños." },
  { cuenta: 0, slug: "camara", titulo: "Cámara Canon EOS con lente 18-55", categoria: "electronicos", precio: "280", ciudad: "Mixco", cantidad: 1,
    descripcion: "Cámara réflex Canon EOS con lente 18-55mm, dos baterías, cargador, memoria de 64GB y bolso. Buena para un evento o un viaje." },
  { cuenta: 1, slug: "dron", titulo: "Dron DJI Mini con estuche", categoria: "electronicos", precio: "350", ciudad: "Ciudad de Guatemala", cantidad: 1,
    descripcion: "Dron DJI Mini con cámara 4K, tres baterías, control remoto y estuche rígido. Pesa menos de 250 gramos. Se entrega con las hélices de repuesto." },
];

// ---------- limpieza ----------
async function borrarTodoLoSembrado() {
  const r = await borrarUsuariosDemo(admin, DOMINIO);
  console.log(`  Borrados: ${r.cuentas} cuentas, ${r.reservas} reservas, ${r.pagos} pagos.`);
  if (r.fallos.length > 0) {
    console.log("  NO se pudieron borrar:");
    for (const f of r.fallos) console.log(`    ${f}`);
    throw new Error("Quedaron datos de ejemplo sin borrar.");
  }
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

  let conFotoReal = 0, conRelleno = 0;

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

    const fotoReal = buscarFotoReal(item.slug);
    const bytesReales = fotoReal ? achicarConSips(fotoReal) : null;
    const color = COLOR_POR_CATEGORIA[item.categoria];

    if (bytesReales) {
      const ruta = `${usuarioId}/${crypto.randomUUID()}.jpg`;
      const { error: errSubida } = await admin.storage
        .from("fotos-items").upload(ruta, bytesReales, { contentType: "image/jpeg" });
      if (errSubida) throw new Error(`No se pudo subir ${item.slug}: ${errSubida.message}`);
      const { data: publica } = admin.storage.from("fotos-items").getPublicUrl(ruta);
      await admin.from("listing_photos").insert({
        listing_id: publicacion.id, url: publica.publicUrl, orden: 0,
      });
      conFotoReal++;
      console.log(`  Publicado: ${item.titulo}  [foto real, ${(bytesReales.length / 1024).toFixed(0)} KB]`);
    } else {
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
      conRelleno++;
      console.log(`  Publicado: ${item.titulo}  [relleno de color — falta fotos-demo/${item.slug}.jpg]`);
    }
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
  console.log(`  ${conFotoReal} con foto real, ${conRelleno} con relleno de color.`);
  if (conRelleno > 0) {
    const faltantes = ITEMS.filter((i) => !buscarFotoReal(i.slug)).map((i) => i.slug + ".jpg");
    console.log(`\n  Para mejorar la demo, poné estas fotos en fotos-demo/ y volvé a correr:`);
    console.log(`  ${faltantes.join(", ")}`);
  }
  console.log(`  ${sinFoto.length} de ellos sin foto (deberían ser 0).`);
  if (visibles.length !== ITEMS.length || sinFoto.length > 0) process.exit(1);
}

if (limpiar) {
  await borrarTodoLoSembrado();
} else {
  await sembrar();
}
