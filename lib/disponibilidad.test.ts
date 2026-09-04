/**
 * Pruebas del cálculo de disponibilidad.
 *
 * CÓMO SE CORREN:   npm test
 *
 * Cada caso de acá viene de la sección 4 de PLAN.md. Son los traslapes donde
 * todo el mundo se equivoca: el que termina justo cuando el otro empieza, el
 * que empieza al día siguiente, y el de varias unidades.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seTraslapan, ocupacionMaxima, hayDisponibilidad, diasSinCupo } from "./disponibilidad.ts";

const r = (inicio: string, fin: string) => ({ inicio_en: inicio, fin_en: fin });

test("rango idéntico se traslapa", () => {
  assert.equal(seTraslapan(r("2026-10-10", "2026-10-12"), r("2026-10-10", "2026-10-12")), true);
});

test("un rango contenido dentro de otro se traslapa", () => {
  assert.equal(seTraslapan(r("2026-10-11", "2026-10-11"), r("2026-10-10", "2026-10-12")), true);
});

test("un rango que contiene al otro se traslapa", () => {
  assert.equal(seTraslapan(r("2026-10-01", "2026-10-31"), r("2026-10-10", "2026-10-12")), true);
});

test("compartir SOLO el último día ya es traslape", () => {
  // Del 10 al 12, y del 12 al 14: el día 12 lo quieren las dos.
  assert.equal(seTraslapan(r("2026-10-10", "2026-10-12"), r("2026-10-12", "2026-10-14")), true);
});

test("empezar el día siguiente NO es traslape", () => {
  assert.equal(seTraslapan(r("2026-10-10", "2026-10-12"), r("2026-10-13", "2026-10-15")), false);
});

test("rangos lejanos no se traslapan", () => {
  assert.equal(seTraslapan(r("2026-10-01", "2026-10-02"), r("2026-12-01", "2026-12-02")), false);
});

test("con 1 unidad, el día ocupado bloquea", () => {
  const reservados = [r("2026-10-10", "2026-10-12")];
  assert.equal(hayDisponibilidad("2026-10-12", "2026-10-14", 1, reservados), false);
  assert.equal(hayDisponibilidad("2026-10-13", "2026-10-15", 1, reservados), true);
});

test("con 3 unidades, tres reservas encimadas llenan el día y la cuarta no entra", () => {
  const tres = [
    r("2026-10-10", "2026-10-12"),
    r("2026-10-11", "2026-10-13"),
    r("2026-10-09", "2026-10-15"),
  ];
  assert.equal(ocupacionMaxima("2026-10-11", "2026-10-12", tres), 3);
  assert.equal(hayDisponibilidad("2026-10-11", "2026-10-12", 3, tres), false);
  assert.equal(hayDisponibilidad("2026-10-11", "2026-10-12", 4, tres), true);
});

test("EL ERROR CLÁSICO: tres reservas que tocan el rango pero no el mismo día", () => {
  // Las tres se traslapan con el rango pedido (10 al 20), pero ningún día
  // concreto tiene más de una encima. Contar traslapes daría 3 y bloquearía
  // mal; contar día por día da 1 y deja pasar, que es lo correcto.
  const separadas = [
    r("2026-10-10", "2026-10-12"),
    r("2026-10-14", "2026-10-16"),
    r("2026-10-18", "2026-10-20"),
  ];
  assert.equal(ocupacionMaxima("2026-10-10", "2026-10-20", separadas), 1);
  assert.equal(hayDisponibilidad("2026-10-10", "2026-10-20", 2, separadas), true);
});

test("una reserva de un solo día se cuenta", () => {
  const uno = [r("2026-10-15", "2026-10-15")];
  assert.equal(ocupacionMaxima("2026-10-15", "2026-10-15", uno), 1);
  assert.equal(hayDisponibilidad("2026-10-15", "2026-10-15", 1, uno), false);
});

test("sin reservas previas, siempre hay lugar", () => {
  assert.equal(ocupacionMaxima("2026-10-10", "2026-10-20", []), 0);
  assert.equal(hayDisponibilidad("2026-10-10", "2026-10-20", 1, []), true);
});

test("diasSinCupo marca exactamente los días llenos", () => {
  const llenos = diasSinCupo("2026-10-09", 6, 1, [r("2026-10-10", "2026-10-12")]);
  assert.deepEqual(llenos, ["2026-10-10", "2026-10-11", "2026-10-12"]);
});

test("diasSinCupo con 2 unidades solo marca donde se llenan las dos", () => {
  const llenos = diasSinCupo("2026-10-09", 6, 2, [
    r("2026-10-10", "2026-10-12"),
    r("2026-10-11", "2026-10-11"),
  ]);
  assert.deepEqual(llenos, ["2026-10-11"]);
});
