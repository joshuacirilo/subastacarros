import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { localInput } from "../../lib/domain";
const origin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const pass = "DemoUMG!2026-1890";
const photos = [
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1000&q=80",
];
async function apiLogin(ctx: BrowserContext, correo: string) {
  const r = await ctx.request.post("/api/auth/ingresar", {
    headers: { Origin: origin },
    data: { correo, password: pass },
  });
  expect(r.status()).toBe(200);
}
async function uiLogin(page: Page, correo: string) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo electrónico").fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(origin + "/");
}
test("publicación, filtros, permisos y pujas concurrentes entre dos sesiones hasta cierre", async ({
  browser,
}, testInfo) => {
  test.skip(
    process.env.E2E_ALLOW_WRITES !== "1",
    "Requiere E2E_ALLOW_WRITES=1: crea publicaciones demo y pujas inmutables en joshua.",
  );
  const owner = await browser.newContext({ baseURL: origin }),
    one = await browser.newContext({ baseURL: origin }),
    two = await browser.newContext({ baseURL: origin }),
    guest = await browser.newContext({ baseURL: origin });
  try {
    await apiLogin(owner, "demo.publicador@subastagt.example");
    const p1 = await one.newPage(),
      p2 = await two.newPage(),
      op = await owner.newPage();
    await uiLogin(p1, "demo.postor1@subastagt.example");
    await uiLogin(p2, "demo.postor2@subastagt.example");
    const catalogs = await (await owner.request.get("/api/catalogos")).json();
    const brand = catalogs.marcas.find(
      (v: { nombre: string }) => v.nombre === "Toyota",
    );
    const model = catalogs.modelos.find(
      (v: { marca_id: number }) => v.marca_id === brand.id,
    );
    const fuel = catalogs.combustibles.find(
      (v: { nombre: string }) => v.nombre === "Gasolina",
    );
    const start = new Date(Math.ceil((Date.now() + 85000) / 60000) * 60000),
      end = new Date(start.getTime() + 60000);
    const marker = "E2E-" + Date.now();
    const data = {
      marca_id: String(brand.id),
      modelo_id: String(model.id),
      tipo_articulo_id: String(catalogs.tipos[0].id),
      transmision_id: String(catalogs.transmisiones[0].id),
      combustible_id: String(fuel.id),
      anio: "2021",
      motor: marker + " 2.0 demo",
      tren_manejo: "FWD",
      numero_cilindros: "4",
      nivel_dano: "AMARILLO",
      monto_base: "100.01",
      inicia_en: localInput(start.toISOString()),
      finaliza_en: localInput(end.toISOString()),
      photos,
    };
    expect(
      (
        await guest.request.post("/api/subastas", {
          headers: { Origin: origin },
          data,
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await owner.request.post("/api/subastas", {
          headers: { Origin: "https://other.example" },
          data,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await owner.request.post("/api/subastas", {
          headers: { Origin: origin },
          data: { ...data, photos: photos.slice(0, 4) },
        })
      ).status(),
    ).toBe(400);
    const other = catalogs.modelos.find(
      (v: { marca_id: number }) => v.marca_id !== brand.id,
    );
    expect(
      (
        await owner.request.post("/api/subastas", {
          headers: { Origin: origin },
          data: { ...data, modelo_id: String(other.id) },
        })
      ).status(),
    ).toBe(400);
    await op.goto("/publicar");
    await op.getByLabel("Marca", { exact: true }).selectOption(data.marca_id);
    await op.getByLabel("Modelo", { exact: true }).selectOption(data.modelo_id);
    for (const label of [
      "Año",
      "Motor",
      "Número de cilindros",
      "Monto base (Q)",
      "Inicio · Guatemala",
      "Cierre · Guatemala",
    ]) {
      const key = (
        {
          Año: "anio",
          Motor: "motor",
          "Número de cilindros": "numero_cilindros",
          "Monto base (Q)": "monto_base",
          "Inicio · Guatemala": "inicia_en",
          "Cierre · Guatemala": "finaliza_en",
        } as const
      )[label as "Año"];
      await op.getByLabel(label, { exact: true }).fill(data[key]);
    }
    for (const [label, value] of [
      ["Tipo de artículo", data.tipo_articulo_id],
      ["Transmisión", data.transmision_id],
      ["Combustible", data.combustible_id],
      ["Tren de manejo", data.tren_manejo],
      ["Nivel de daño", data.nivel_dano],
    ])
      await op.getByLabel(label, { exact: true }).selectOption(value);
    await op
      .getByLabel("URL de fotografías", { exact: true })
      .fill(photos.join("\n"));
    await op.getByRole("button", { name: "Publicar subasta" }).click();
    await expect(op).toHaveURL(/\/subastas\/\d+$/);
    const id = Number(op.url().split("/").pop());
    const detail = await (
      await guest.request.get("/api/subastas/" + id)
    ).json();
    expect(detail.photos.length).toBe(5);
    expect(detail.state.startsAt).toBe(start.toISOString());
    expect(detail).not.toHaveProperty("propietario_id");
    expect(detail.state).not.toHaveProperty("usuario_id");
    await op
      .getByRole("button", { name: "Foto siguiente", exact: true })
      .click();
    await expect(op.locator(".gallery-counter")).toHaveText("2 / 5");
    expect(
      (
        await one.request.patch("/api/subastas/" + id, {
          headers: { Origin: origin },
          data,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await owner.request.patch("/api/subastas/" + id, {
          headers: { Origin: origin },
          data: { ...data, motor: marker + " editado" },
        })
      ).status(),
    ).toBe(200);
    const noData = await owner.request.post("/api/subastas/" + id + "/pujas", {
      headers: { Origin: origin },
      data: { monto: "100.01" },
    });
    expect(noData.status()).toBe(409);
    expect(
      (
        await guest.request.post("/api/subastas/" + id + "/pujas", {
          headers: { Origin: origin },
          data: { monto: "100.01" },
        })
      ).status(),
    ).toBe(401);
    await op.goto("/");
    await op.getByLabel("Buscar", { exact: true }).fill(marker);
    await op.getByLabel("Marca", { exact: true }).selectOption(data.marca_id);
    await op.getByLabel("Año", { exact: true }).fill(data.anio);
    await op
      .getByLabel("Combustible", { exact: true })
      .selectOption(data.combustible_id);
    await op.getByLabel("Daño", { exact: true }).selectOption(data.nivel_dano);
    await op.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(op.locator(".vehicle-card")).toHaveCount(1);
    await op.screenshot({
      path: testInfo.outputPath("inventario-desktop.png"),
      fullPage: true,
    });
    const mismatch = await (
      await guest.request.get(
        "/api/subastas?marca=" +
          data.marca_id +
          "&anio=1990&dano=AMARILLO&q=" +
          marker,
      )
    ).json();
    expect(mismatch.items).toHaveLength(0);
    const mine = await (
      await one.request.get("/api/subastas?mine=1&q=" + marker)
    ).json();
    expect(mine.items).toHaveLength(0);
    const orphanCount = await (
      await owner.request.get("/api/subastas?mine=1&q=" + marker)
    ).json();
    expect(orphanCount.total).toBe(1);
    const desertedResponse = await one.request.post("/api/subastas", {
      headers: { Origin: origin },
      data: { ...data, motor: marker + " desierta" },
    });
    expect(desertedResponse.status()).toBe(201);
    const desertedId = (await desertedResponse.json()).id;
    await p1.goto("/subastas/" + id);
    await p2.goto("/subastas/" + id);
    await expect
      .poll(
        async () => {
          const d = await (
            await one.request.get("/api/subastas/" + id + "/estado")
          ).json();
          return d.status;
        },
        { timeout: 150000, intervals: [1000] },
      )
      .toBe("activa");
    await expect(
      p1.getByRole("button", { name: "Hacer oferta" }),
    ).toBeEnabled();
    await p1.getByLabel("Tu oferta (Q)", { exact: true }).fill("100.01");
    await p1.getByRole("button", { name: "Hacer oferta" }).click();
    await expect(p1.getByTestId("position")).toHaveText(
      "¡Vas ganando esta subasta!",
    );
    await expect(p2.getByTestId("highest")).toContainText("100.01");
    expect(
      (
        await two.request.post("/api/subastas/" + id + "/pujas", {
          headers: { Origin: origin },
          data: { monto: "110.01" },
        })
      ).status(),
    ).toBe(409);
    await p2.getByLabel("Tu oferta (Q)", { exact: true }).fill("110.02");
    await p2.getByRole("button", { name: "Hacer oferta" }).click();
    await expect(p2.getByTestId("position")).toHaveText(
      "¡Vas ganando esta subasta!",
    );
    await expect(p1.getByTestId("position")).toHaveText(
      "Tu oferta ha sido superada",
    );
    await expect(p1.getByTestId("highest")).toContainText("110.02");
    await p1.screenshot({
      path: testInfo.outputPath("postor-superado.png"),
      fullPage: true,
    });
    await p2.screenshot({
      path: testInfo.outputPath("postor-ganando.png"),
      fullPage: true,
    });
    const race = await Promise.all(
      [one, two].map((ctx) =>
        ctx.request.post("/api/subastas/" + id + "/pujas", {
          headers: { Origin: origin },
          data: { monto: "121.03" },
        }),
      ),
    );
    expect(race.map((r) => r.status()).sort()).toEqual([201, 409]);
    const publicState = await (
      await guest.request.get("/api/subastas/" + id + "/estado")
    ).json();
    expect(publicState.highest).toBe("121.03");
    expect(publicState.bidCount).toBe(3);
    expect(Object.keys(publicState).sort()).toEqual(
      [
        "id",
        "base",
        "highest",
        "minimum",
        "startsAt",
        "endsAt",
        "serverNow",
        "status",
        "bidCount",
        "winning",
        "outbid",
        "sold",
      ].sort(),
    );
    expect(publicState.winning).toBe(false);
    expect(publicState.outbid).toBe(false);
    expect(
      (
        await owner.request.patch("/api/subastas/" + id, {
          headers: { Origin: origin },
          data,
        })
      ).status(),
    ).toBe(409);
    const before = await p1.getByTestId("countdown").textContent();
    await p1.waitForTimeout(1300);
    expect(await p1.getByTestId("countdown").textContent()).not.toBe(before);
    await expect
      .poll(
        async () => {
          const d = await (
            await one.request.get("/api/subastas/" + id + "/estado")
          ).json();
          return d.status;
        },
        { timeout: 75000, intervals: [1000] },
      )
      .toBe("cerrada");
    await expect(
      p1.getByText("Subasta cerrada", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await two.request.post("/api/subastas/" + id + "/pujas", {
          headers: { Origin: origin },
          data: { monto: "200.00" },
        })
      ).status(),
    ).toBe(409);
    const final = await (
      await guest.request.get("/api/subastas/" + id + "/estado")
    ).json();
    expect(final.sold).toBe(true);
    const desertedState = await (
      await guest.request.get("/api/subastas/" + desertedId + "/estado")
    ).json();
    expect(desertedState.status).toBe("cerrada");
    expect(desertedState.sold).toBe(false);
    await op.goto("/subastas/" + desertedId);
    await expect(
      op.getByText("No vendida / desierta", { exact: true }),
    ).toBeVisible();
    await p2.getByRole("button", { name: "Salir", exact: true }).click();
    await expect(
      p2.getByRole("link", { name: "Crear cuenta", exact: true }),
    ).toBeVisible();
    expect(
      (
        await two.request.post("/api/subastas/" + id + "/pujas", {
          headers: { Origin: origin },
          data: { monto: "200.00" },
        })
      ).status(),
    ).toBe(401);
    console.log(
      "E2E completado: subasta demo #" +
        id +
        " cerrada con tres pujas inmutables.",
    );
  } finally {
    await Promise.all([owner, one, two, guest].map((c) => c.close()));
  }
});
