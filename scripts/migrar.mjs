/**
 * Aplica las migraciones pendientes directamente sobre la base de datos.
 *
 * POR QUÉ EXISTE: copiar y pegar SQL en el panel de Supabase es frágil. El
 * portapapeles se pisa, el editor corre solo lo que está seleccionado, y una
 * migración a medias deja la base en un estado peor que no haberla corrido.
 * Esto lee los archivos de supabase/migrations/, ve cuáles faltan, y los
 * aplica en orden.
 *
 * CADA MIGRACIÓN CORRE DENTRO DE UNA TRANSACCIÓN: si una línea falla, se
 * deshace TODA esa migración. Nunca queda a medias.
 *
 * CÓMO SE CORRE:
 *   npm run migrar                  → aplica lo que falte
 *   npm run migrar -- --ver         → solo dice qué falta, sin tocar nada
 *   npm run migrar -- --marcar-hasta 0007
 *                                   → anota 0001..0007 como ya aplicadas, sin
 *                                     ejecutarlas. Se usa UNA sola vez, porque
 *                                     esas se corrieron a mano en el panel.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const CARPETA = path.join(process.cwd(), "supabase", "migrations");
const cadena = process.env.SUPABASE_DB_URL;

if (!cadena || cadena.includes("CONTRASENA")) {
  console.error(`
  Falta SUPABASE_DB_URL en .env.local.

  Dónde conseguirla:
    Supabase → Project Settings → Database → Connection string → URI
    Copiala y reemplazá [YOUR-PASSWORD] por la contraseña de la base.
    Si no la recordás, en esa misma pantalla podés generar una nueva.

  Usá el puerto 5432 (no el 6543): el 6543 no sirve para crear tablas.
`);
  process.exit(1);
}

const soloVer = process.argv.includes("--ver");
const indiceMarcar = process.argv.indexOf("--marcar-hasta");
const marcarHasta = indiceMarcar !== -1 ? process.argv[indiceMarcar + 1] : null;

const archivos = fs.readdirSync(CARPETA).filter((f) => f.endsWith(".sql")).sort();

const cliente = new pg.Client({
  connectionString: cadena,
  // Supabase exige conexión cifrada. No se verifica el certificado porque el
  // servidor usa uno propio; la conexión sigue yendo cifrada.
  ssl: { rejectUnauthorized: false },
});

try {
  await cliente.connect();
} catch (fallo) {
  console.error(`
  No se pudo conectar a la base de datos.

  ${fallo.message}

  Lo más común: la contraseña quedó mal copiada, o la cadena usa el puerto
  6543 en vez del 5432.
`);
  process.exit(1);
}

try {
  await cliente.query(`
    create table if not exists public.migraciones_aplicadas (
      nombre      text primary key,
      aplicada_en timestamptz not null default now()
    )
  `);

  const { rows } = await cliente.query("select nombre from public.migraciones_aplicadas");
  const yaAplicadas = new Set(rows.map((r) => r.nombre));

  if (marcarHasta) {
    const marcar = archivos.filter((f) => f.slice(0, 4) <= marcarHasta && !yaAplicadas.has(f));
    for (const archivo of marcar) {
      await cliente.query(
        "insert into public.migraciones_aplicadas (nombre) values ($1) on conflict do nothing",
        [archivo]
      );
      console.log(`  anotada como ya aplicada:  ${archivo}`);
    }
    console.log(`\n  ${marcar.length} migraciones anotadas. No se ejecutó ninguna.`);
    process.exit(0);
  }

  const pendientes = archivos.filter((f) => !yaAplicadas.has(f));

  console.log(`\n  ${archivos.length} migraciones en total, ${pendientes.length} pendientes.\n`);

  if (pendientes.length === 0) {
    console.log("  Todo al día.\n");
    process.exit(0);
  }

  for (const archivo of pendientes) console.log(`  pendiente:  ${archivo}`);

  if (soloVer) {
    console.log("\n  (--ver: no se aplicó nada)\n");
    process.exit(0);
  }

  console.log("");
  for (const archivo of pendientes) {
    const crudo = fs.readFileSync(path.join(CARPETA, archivo), "utf8");

    // Algunas migraciones traen su propio begin/commit para que también sean
    // seguras al pegarlas en el panel de Supabase. Acá se los sacamos: la
    // transacción la maneja este script, y así el registro de "aplicada"
    // queda dentro de la misma operación que la migración.
    const sql = crudo
      .replace(/^\s*begin\s*;/im, "")
      .replace(/commit\s*;\s*$/im, "");

    process.stdout.write(`  aplicando ${archivo} … `);
    try {
      await cliente.query("begin");
      await cliente.query(sql);
      await cliente.query(
        "insert into public.migraciones_aplicadas (nombre) values ($1)",
        [archivo]
      );
      await cliente.query("commit");
      console.log("listo");
    } catch (fallo) {
      await cliente.query("rollback");
      console.log("FALLÓ");
      console.error(`\n  ${archivo} no se aplicó y se deshizo por completo.`);
      console.error(`  La base quedó como estaba antes de intentarlo.\n`);
      console.error(`  Motivo: ${fallo.message}`);
      if (fallo.position) console.error(`  Posición en el archivo: carácter ${fallo.position}`);
      process.exit(1);
    }
  }

  console.log("\n  Todas las migraciones quedaron aplicadas.\n");
} finally {
  await cliente.end();
}
