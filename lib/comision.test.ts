/**
 * Pruebas del reparto del dinero.
 *
 * Lo que se prueba de verdad es una sola cosa, y es la que importa:
 * comisión + publicador tiene que dar EXACTAMENTE el total, siempre.
 * Es lo mismo que exige la base de datos, así que si esto falla, la reserva
 * ni siquiera se puede guardar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { repartirDinero } from "./comision.ts";

test("15% de un total redondo", () => {
  const r = repartirDinero(120000, 0.15); // Q1,200.00
  assert.equal(r.comisionCentavos, 18000);
  assert.equal(r.publicadorCentavos, 102000);
});

test("el redondeo nunca descuadra la suma", () => {
  // Q99.99 al 15% son 1499.85 centavos, que no existen.
  const r = repartirDinero(9999, 0.15);
  assert.equal(r.comisionCentavos, 1500);
  assert.equal(r.publicadorCentavos, 8499);
  assert.equal(r.comisionCentavos + r.publicadorCentavos, 9999);
});

test("las partes suman el total en mil montos distintos", () => {
  for (let total = 100; total <= 100000; total += 97) {
    const r = repartirDinero(total, 0.15);
    assert.equal(r.comisionCentavos + r.publicadorCentavos, total, `falló con ${total}`);
  }
});

test("comisión en 0 deja todo al publicador", () => {
  const r = repartirDinero(50000, 0);
  assert.equal(r.comisionCentavos, 0);
  assert.equal(r.publicadorCentavos, 50000);
});

test("rechaza decimales, porque el dinero va en centavos enteros", () => {
  assert.throws(() => repartirDinero(125.5, 0.15), /centavos enteros/);
});

test("rechaza un porcentaje imposible", () => {
  assert.throws(() => repartirDinero(10000, 1.5), /entre 0 y 1/);
});
