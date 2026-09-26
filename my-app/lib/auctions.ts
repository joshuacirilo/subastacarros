import "server-only";
import sql from "mssql";
import { getPool } from "./db/connection";
import { transaction } from "./db/transaction";
import {
  AppError,
  minimumBid,
  moneyCents,
  decimal,
  type Auction,
  type AuctionState,
  type Catalogs,
} from "./domain";
import { publication, id } from "./validation";

export async function catalogs(): Promise<Catalogs> {
  const r = await (await getPool()).request().query(`
 SELECT id,nombre FROM joshua.marcas_1890212310 ORDER BY nombre;
 SELECT id,marca_id,nombre FROM joshua.modelos_1890212310 ORDER BY nombre;
 SELECT id,nombre FROM joshua.tipos_articulo_1890212310 ORDER BY nombre;
 SELECT id,nombre FROM joshua.transmisiones_1890212310 ORDER BY nombre;
 SELECT id,nombre FROM joshua.combustibles_1890212310 ORDER BY nombre;`);
  const sets = r.recordsets as sql.IRecordSet<{
    id: number;
    nombre: string;
    marca_id: number;
  }>[];
  return {
    marcas: sets[0],
    modelos: sets[1],
    tipos: sets[2],
    transmisiones: sets[3],
    combustibles: sets[4],
  };
}
type StateRow = {
  id: number;
  base: string;
  highest: string | null;
  inicia_en: Date;
  finaliza_en: Date;
  server_now: Date;
  bid_count: number;
  winning: boolean;
  participated: boolean;
};
function stateDTO(row: StateRow): AuctionState {
  const now = row.server_now.getTime(),
    start = row.inicia_en.getTime(),
    end = row.finaliza_en.getTime();
  return {
    id: row.id,
    base: row.base,
    highest: row.highest,
    minimum: minimumBid(row.base, row.highest),
    startsAt: row.inicia_en.toISOString(),
    endsAt: row.finaliza_en.toISOString(),
    serverNow: row.server_now.toISOString(),
    status: now < start ? "programada" : now < end ? "activa" : "cerrada",
    bidCount: row.bid_count,
    winning: !!row.winning,
    outbid: !!row.participated && !row.winning,
    sold: now >= end && row.highest !== null,
  };
}
const STATE_COLUMNS = `CONVERT(varchar(32),s.monto_base) AS base,CONVERT(varchar(32),topbid.monto) AS highest,
 s.inicia_en,s.finaliza_en,SYSUTCDATETIME() AS server_now,
 (SELECT COUNT(*) FROM joshua.pujas_1890212310 bp WHERE bp.subasta_id=s.id) AS bid_count,
 CAST(CASE WHEN topbid.usuario_id=@user THEN 1 ELSE 0 END AS bit) AS winning,
 CAST(CASE WHEN EXISTS(SELECT 1 FROM joshua.pujas_1890212310 mine WHERE mine.subasta_id=s.id AND mine.usuario_id=@user) THEN 1 ELSE 0 END AS bit) AS participated`;
const TOP_BID = `OUTER APPLY (SELECT TOP (1) p.monto,p.usuario_id FROM joshua.pujas_1890212310 p WHERE p.subasta_id=s.id ORDER BY p.monto DESC,p.id ASC) topbid`;
export async function auctionState(
  auctionId: number,
  userId: number | null,
): Promise<AuctionState> {
  const r = await (
    await getPool()
  )
    .request()
    .input("id", sql.Int, auctionId)
    .input("user", sql.Int, userId)
    .query<StateRow>(
      `SELECT s.id,${STATE_COLUMNS} FROM joshua.subastas_1890212310 s ${TOP_BID} WHERE s.id=@id`,
    );
  if (!r.recordset[0]) throw new AppError("Subasta no encontrada.", 404);
  return stateDTO(r.recordset[0]);
}
type AuctionRow = StateRow & {
  vehicleId: number;
  marca: string;
  modelo: string;
  anio: number;
  motor: string;
  tipo: string;
  transmision: string;
  combustible: string;
  tren_manejo: string;
  numero_cilindros: number;
  nivel_dano: string;
  marca_id: number;
  modelo_id: number;
  tipo_articulo_id: number;
  transmision_id: number;
  combustible_id: number;
  mine: boolean;
  photos_json: string;
  total: number;
};
export async function inventory(
  params: URLSearchParams,
  userId: number | null,
  auctionId?: number,
): Promise<{ items: Auction[]; total: number; page: number; pages: number }> {
  const request = (await getPool()).request().input("user", sql.Int, userId);
  const conditions: string[] = [];
  for (const [key, column] of [
    ["marca", "ma.id"],
    ["modelo", "mo.id"],
    ["combustible", "v.combustible_id"],
    ["anio", "v.anio"],
  ] as const) {
    const value = params.get(key);
    if (value) {
      request.input(key, sql.Int, id(value));
      conditions.push(`${column}=@${key}`);
    }
  }
  const damage = params.get("dano");
  if (damage) {
    if (!["VERDE", "AMARILLO", "ROJO"].includes(damage))
      throw new AppError("Filtro de daño inválido.");
    request.input("damage", sql.VarChar(8), damage);
    conditions.push("v.nivel_dano=@damage");
  }
  const query = params.get("q")?.trim();
  if (query) {
    if (query.length > 100)
      throw new AppError("La búsqueda es demasiado larga.");
    request.input("q", sql.NVarChar(100), query);
    conditions.push(
      "(CHARINDEX(@q,CONCAT(ma.nombre,N' ',mo.nombre,N' ',v.anio,N' ',v.motor))>0)",
    );
  }
  if (params.get("mine") === "1") {
    if (!userId)
      throw new AppError("Inicia sesión para ver tus publicaciones.", 401);
    conditions.push("v.propietario_id=@user");
  }
  if (auctionId) {
    request.input("id", sql.Int, auctionId);
    conditions.push("s.id=@id");
  }
  const page = params.get("page") ? id(params.get("page")) : 1;
  const offset = (page - 1) * 12;
  if (offset > 1000000) throw new AppError("Página inválida.");
  request.input("offset", sql.Int, offset);
  const result = await request.query<AuctionRow>(`
 SELECT s.id,v.id AS vehicleId,ma.nombre AS marca,mo.nombre AS modelo,v.anio,v.motor,
 t.nombre AS tipo,tr.nombre AS transmision,c.nombre AS combustible,
 v.tren_manejo,v.numero_cilindros,v.nivel_dano,ma.id AS marca_id,v.modelo_id,v.tipo_articulo_id,v.transmision_id,v.combustible_id,
 CAST(CASE WHEN v.propietario_id=@user THEN 1 ELSE 0 END AS bit) AS mine,${STATE_COLUMNS},
 (SELECT f.url FROM joshua.fotos_vehiculo_1890212310 f WHERE f.vehiculo_id=v.id ORDER BY f.orden,f.id FOR JSON PATH) AS photos_json,
 COUNT(*) OVER() AS total
 FROM joshua.subastas_1890212310 s JOIN joshua.vehiculos_1890212310 v ON v.id=s.vehiculo_id
 JOIN joshua.modelos_1890212310 mo ON mo.id=v.modelo_id JOIN joshua.marcas_1890212310 ma ON ma.id=mo.marca_id
 JOIN joshua.tipos_articulo_1890212310 t ON t.id=v.tipo_articulo_id
 JOIN joshua.transmisiones_1890212310 tr ON tr.id=v.transmision_id JOIN joshua.combustibles_1890212310 c ON c.id=v.combustible_id
 ${TOP_BID} ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
 ORDER BY s.creado_en DESC,s.id DESC OFFSET @offset ROWS FETCH NEXT 12 ROWS ONLY`);
  const items = result.recordset.map((row) => {
    const state = stateDTO(row);
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      marca: row.marca,
      modelo: row.modelo,
      anio: row.anio,
      motor: row.motor,
      tipo: row.tipo,
      transmision: row.transmision,
      combustible: row.combustible,
      tren_manejo: row.tren_manejo,
      numero_cilindros: row.numero_cilindros,
      nivel_dano: row.nivel_dano,
      marca_id: row.marca_id,
      modelo_id: row.modelo_id,
      tipo_articulo_id: row.tipo_articulo_id,
      transmision_id: row.transmision_id,
      combustible_id: row.combustible_id,
      photos: (JSON.parse(row.photos_json) as { url: string }[]).map(
        (p) => p.url,
      ),
      mine: !!row.mine,
      editable:
        !!row.mine && state.status === "programada" && state.bidCount === 0,
      state,
    };
  });
  if (auctionId && !items.length)
    throw new AppError("Subasta no encontrada.", 404);
  const total = result.recordset[0]?.total ?? 0;
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 12)) };
}

export async function savePublication(
  userId: number,
  input: unknown,
  auctionId?: number,
): Promise<number> {
  const data = publication(input);
  return transaction(async (tx) => {
    let vehicleId: number | undefined;
    if (auctionId) {
      // Lock the same auction row as bidding before inspecting edit eligibility.
      const lock = await tx.request().input("id", sql.Int, auctionId).query<{
        vehiculo_id: number;
        propietario_id: number;
        editable: boolean;
      }>(`
    SELECT s.vehiculo_id,v.propietario_id,CAST(CASE WHEN s.inicia_en>SYSUTCDATETIME() AND NOT EXISTS(SELECT 1 FROM joshua.pujas_1890212310 p WHERE p.subasta_id=s.id) THEN 1 ELSE 0 END AS bit) AS editable
    FROM joshua.subastas_1890212310 s WITH(UPDLOCK,HOLDLOCK) JOIN joshua.vehiculos_1890212310 v ON v.id=s.vehiculo_id WHERE s.id=@id`);
      const row = lock.recordset[0];
      if (!row) throw new AppError("Publicación no encontrada.", 404);
      if (row.propietario_id !== userId)
        throw new AppError("Solo puedes editar tus publicaciones.", 403);
      if (!row.editable)
        throw new AppError(
          "No se puede editar: la subasta ya comenzó o tiene ofertas.",
          409,
        );
      vehicleId = row.vehiculo_id;
    }
    const model = await tx
      .request()
      .input("model", sql.Int, data.modelo_id)
      .input("brand", sql.Int, data.marca_id)
      .query(
        "SELECT id FROM joshua.modelos_1890212310 WHERE id=@model AND marca_id=@brand",
      );
    if (!model.recordset.length)
      throw new AppError("El modelo no corresponde a la marca seleccionada.");
    const clock = await tx
      .request()
      .query<{ now: Date }>("SELECT SYSUTCDATETIME() AS now");
    if (data.starts <= clock.recordset[0].now)
      throw new AppError(
        "El inicio debe ser posterior a la hora actual de Guatemala.",
      );
    const request = tx
      .request()
      .input("owner", sql.Int, userId)
      .input("model", sql.Int, data.modelo_id)
      .input("type", sql.Int, data.tipo_articulo_id)
      .input("transmission", sql.Int, data.transmision_id)
      .input("fuel", sql.Int, data.combustible_id)
      .input("year", sql.SmallInt, data.anio)
      .input("engine", sql.NVarChar(150), data.motor)
      .input("drive", sql.VarChar(3), data.tren_manejo)
      .input("cylinders", sql.TinyInt, data.numero_cilindros)
      .input("damage", sql.VarChar(8), data.nivel_dano);
    if (vehicleId) {
      await request
        .input("vehicle", sql.Int, vehicleId)
        .query(
          `UPDATE joshua.vehiculos_1890212310 SET modelo_id=@model,tipo_articulo_id=@type,transmision_id=@transmission,combustible_id=@fuel,anio=@year,motor=@engine,tren_manejo=@drive,numero_cilindros=@cylinders,nivel_dano=@damage,actualizado_en=SYSUTCDATETIME() WHERE id=@vehicle AND propietario_id=@owner`,
        );
      await tx
        .request()
        .input("vehicle", sql.Int, vehicleId)
        .query(
          "DELETE FROM joshua.fotos_vehiculo_1890212310 WHERE vehiculo_id=@vehicle",
        );
    } else {
      const r = await request.query<{ id: number }>(
        `INSERT INTO joshua.vehiculos_1890212310(propietario_id,modelo_id,tipo_articulo_id,transmision_id,combustible_id,anio,motor,tren_manejo,numero_cilindros,nivel_dano) OUTPUT inserted.id VALUES(@owner,@model,@type,@transmission,@fuel,@year,@engine,@drive,@cylinders,@damage)`,
      );
      vehicleId = r.recordset[0].id;
    }
    for (const [order, url] of data.photos.entries())
      await tx
        .request()
        .input("vehicle", sql.Int, vehicleId)
        .input("url", sql.NVarChar(2048), url)
        .input("order", sql.Int, order + 1)
        .query(
          "INSERT INTO joshua.fotos_vehiculo_1890212310(vehiculo_id,url,orden) VALUES(@vehicle,@url,@order)",
        );
    const auction = tx
      .request()
      .input("vehicle", sql.Int, vehicleId)
      .input("base", sql.VarChar(32), data.base)
      .input("start", sql.DateTime2, data.starts)
      .input("end", sql.DateTime2, data.ends);
    if (auctionId) {
      const updated = await auction
        .input("id", sql.Int, auctionId)
        .query(
          `UPDATE joshua.subastas_1890212310 SET monto_base=CAST(@base AS decimal(18,2)),inicia_en=@start,finaliza_en=@end,actualizado_en=SYSUTCDATETIME() WHERE id=@id AND inicia_en>SYSUTCDATETIME() AND @start>SYSUTCDATETIME()`,
        );
      if (updated.rowsAffected[0] !== 1)
        throw new AppError(
          "La subasta comenzó mientras guardabas. No se aplicaron cambios.",
          409,
        );
      return auctionId;
    }
    const r = await auction.query<{ id: number }>(
      `INSERT INTO joshua.subastas_1890212310(vehiculo_id,monto_base,inicia_en,finaliza_en) OUTPUT inserted.id SELECT @vehicle,CAST(@base AS decimal(18,2)),@start,@end WHERE @start>SYSUTCDATETIME()`,
    );
    if (!r.recordset[0])
      throw new AppError(
        "La hora de inicio ya pasó. No se guardó la publicación.",
        409,
      );
    return r.recordset[0].id;
  });
}

export async function placeBid(
  auctionId: number,
  userId: number,
  value: unknown,
): Promise<void> {
  const amount = decimal(moneyCents(value));
  await transaction(async (tx) => {
    // Held until commit: all writers serialize through this specific auction.
    const locked = await tx
      .request()
      .input("id", sql.Int, auctionId)
      .query(
        "SELECT id FROM joshua.subastas_1890212310 WITH(UPDLOCK,HOLDLOCK) WHERE id=@id",
      );
    if (!locked.recordset.length)
      throw new AppError("Subasta no encontrada.", 404);
    // Read the database clock AFTER obtaining the lock (a wait may cross closing).
    const r = await tx.request().input("id", sql.Int, auctionId).query<{
      base: string;
      highest: string | null;
      open: boolean;
    }>(`
   SELECT CONVERT(varchar(32),s.monto_base) AS base,
   (SELECT CONVERT(varchar(32),MAX(p.monto)) FROM joshua.pujas_1890212310 p WHERE p.subasta_id=s.id) AS highest,
   CAST(CASE WHEN SYSUTCDATETIME()>=s.inicia_en AND SYSUTCDATETIME()<s.finaliza_en THEN 1 ELSE 0 END AS bit) AS [open]
   FROM joshua.subastas_1890212310 s WHERE s.id=@id`);
    const row = r.recordset[0];
    if (!row.open)
      throw new AppError(
        "La subasta todavía no inicia o ya está cerrada.",
        409,
      );
    const minimum = minimumBid(row.base, row.highest);
    if (moneyCents(amount) < moneyCents(minimum))
      throw new AppError(`La oferta mínima actual es Q ${minimum}.`, 409);
    const insert = await tx
      .request()
      .input("id", sql.Int, auctionId)
      .input("user", sql.Int, userId)
      .input("amount", sql.VarChar(32), amount).query(`
   INSERT INTO joshua.pujas_1890212310(subasta_id,usuario_id,monto)
   SELECT id,@user,CAST(@amount AS decimal(18,2)) FROM joshua.subastas_1890212310
   WHERE id=@id AND SYSUTCDATETIME()>=inicia_en AND SYSUTCDATETIME()<finaliza_en`);
    if (insert.rowsAffected[0] !== 1)
      throw new AppError("La subasta cerró antes de registrar la oferta.", 409);
  });
}
