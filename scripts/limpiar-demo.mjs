/**
 * Borrado ordenado de los datos de ejemplo.
 *
 * POR QUÉ HACE FALTA UN ORDEN: la base de datos tiene `on delete restrict`
 * sobre reservas y pagos a propósito. Borrar una cuenta NO puede arrastrarse
 * su historial de dinero: si eso fuera posible, cualquiera podría hacer
 * desaparecer una operación borrando un usuario.
 *
 * La consecuencia práctica es que hay que desarmar de adentro hacia afuera:
 *   pagos → reservas → fotos → cuenta (que sí arrastra sus publicaciones)
 *
 * Si se intenta borrar la cuenta primero, Supabase responde "Database error
 * deleting user" y no dice más. Este archivo existe para que eso no vuelva
 * a pasar en silencio.
 */

export async function borrarUsuariosDemo(admin, dominio) {
  const { data: lista, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`No se pudo listar usuarios: ${error.message}`);

  const demos = (lista?.users ?? []).filter((u) => u.email?.endsWith(`@${dominio}`));
  const ids = demos.map((u) => u.id);
  if (ids.length === 0) return { cuentas: 0, reservas: 0, pagos: 0, fallos: [] };

  // Las publicaciones de estas cuentas: sus reservas también hay que sacarlas,
  // aunque quien reservó sea otra persona.
  const { data: publicaciones } = await admin.from("listings").select("id").in("user_id", ids);
  const idsPublicaciones = (publicaciones ?? []).map((l) => l.id);

  // 1. Reservas: las que hicieron estas cuentas y las que recibieron.
  let reservas = [];
  const { data: comoInquilino } = await admin.from("reservations").select("id").in("renter_id", ids);
  reservas.push(...(comoInquilino ?? []).map((r) => r.id));
  if (idsPublicaciones.length > 0) {
    const { data: comoDueno } = await admin.from("reservations").select("id").in("listing_id", idsPublicaciones);
    reservas.push(...(comoDueno ?? []).map((r) => r.id));
  }
  reservas = [...new Set(reservas)];

  // 2. Pagos primero, que cuelgan de las reservas.
  let pagos = 0;
  if (reservas.length > 0) {
    const { data: borrados } = await admin.from("payments").delete().in("reservation_id", reservas).select("id");
    pagos = borrados?.length ?? 0;
    const { error: errRes } = await admin.from("reservations").delete().in("id", reservas);
    if (errRes) throw new Error(`No se pudieron borrar las reservas: ${errRes.message}`);
  }

  // 3. Fotos en el almacenamiento.
  for (const id of ids) {
    const { data: archivos } = await admin.storage.from("fotos-items").list(id);
    if (archivos?.length) {
      await admin.storage.from("fotos-items").remove(archivos.map((a) => `${id}/${a.name}`));
    }
  }

  // 4. Recién ahora las cuentas. Las publicaciones se van solas (on delete cascade).
  const fallos = [];
  for (const u of demos) {
    const { error: errBorrar } = await admin.auth.admin.deleteUser(u.id);
    if (errBorrar) fallos.push(`${u.email}: ${errBorrar.message}`);
  }

  return { cuentas: demos.length - fallos.length, reservas: reservas.length, pagos, fallos };
}
