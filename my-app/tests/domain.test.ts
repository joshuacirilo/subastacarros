import { test } from "node:test";
import assert from "node:assert/strict";
import {
  minimumBid,
  moneyCents,
  guatemalaDate,
  localInput,
} from "../lib/domain";
import { publication } from "../lib/validation";
import { hashPassword, verifyPassword } from "../lib/password";
test("first bid equals base, later bids ceil exactly to the next cent", () => {
  assert.equal(minimumBid("100.00", null), "100.00");
  assert.equal(minimumBid("100.00", "100.01"), "110.02");
  assert.equal(minimumBid("100.00", "110.00"), "121.00");
  assert.equal(minimumBid("0.01", "0.01"), "0.02");
  assert.equal(minimumBid("1.00", "9000000000000.01"), "9900000000000.02");
});
test("money rejects invalid, negative and overprecision values", () => {
  for (const v of [
    "0",
    "-1",
    "1e6",
    "1.001",
    NaN,
    100,
    "Infinity",
    "10000000000000000",
  ])
    assert.throws(() => moneyCents(v));
});
test("Guatemala input converts to UTC with date validation", () => {
  const d = guatemalaDate("2026-09-26T18:30");
  assert.equal(d.toISOString(), "2026-09-27T00:30:00.000Z");
  assert.equal(localInput(d.toISOString()), "2026-09-26T18:30");
  assert.throws(() => guatemalaDate("2026-02-30T10:00"));
});
test("publication rejects fewer than five images, duplicate URLs, unsafe URLs and reversed dates", () => {
  const base = {
    marca_id: 1,
    modelo_id: 1,
    tipo_articulo_id: 1,
    transmision_id: 1,
    combustible_id: 1,
    anio: 2020,
    motor: "2.0",
    tren_manejo: "FWD",
    numero_cilindros: 4,
    nivel_dano: "VERDE",
    monto_base: "100.00",
    inicia_en: "2028-01-01T10:00",
    finaliza_en: "2028-01-01T12:00",
    photos: Array.from(
      { length: 5 },
      (_, i) => `https://example.com/car-${i}.jpg`,
    ),
  };
  assert.equal(publication(base).photos.length, 5);
  assert.throws(() => publication({ ...base, photos: base.photos.slice(1) }));
  assert.throws(() =>
    publication({ ...base, photos: Array(5).fill(base.photos[0]) }),
  );
  assert.throws(() =>
    publication({
      ...base,
      photos: ["javascript:alert(1)", ...base.photos.slice(1)],
    }),
  );
  assert.throws(() =>
    publication({ ...base, finaliza_en: "2028-01-01T09:00" }),
  );
});
test("password hashing uses independent salts and verifies securely", async () => {
  const a = await hashPassword("Demo-only-password-1"),
    b = await hashPassword("Demo-only-password-1");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("Demo-only-password-1", a), true);
  assert.equal(await verifyPassword("bad", a), false);
  assert.equal(await verifyPassword("bad", "malformed"), false);
});
