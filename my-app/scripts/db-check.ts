import { loadEnvConfig } from "@next/env";
import sql from "mssql";
import { closePool, getPool } from "../lib/db/connection";
import { DatabaseConfigError, describeDatabaseError } from "../lib/db/errors";

const TABLES = [
  "usuarios_1890212310",
  "marcas_1890212310",
  "modelos_1890212310",
  "tipos_articulo_1890212310",
  "transmisiones_1890212310",
  "combustibles_1890212310",
  "vehiculos_1890212310",
  "fotos_vehiculo_1890212310",
  "subastas_1890212310",
  "pujas_1890212310",
] as const;

let failures = 0;

async function check(label: string, operation: () => Promise<boolean>): Promise<boolean> {
  try {
    if (await operation()) {
      console.log(`[OK] ${label}`);
      return true;
    }
    console.error(`[FALLO] ${label}`);
  } catch (error) {
    console.error(`[FALLO] ${label}: ${describeDatabaseError(error)}`);
  }
  failures += 1;
  return false;
}

function skippedChecks(reason: string): void {
  console.log(`[OMITIDO] Esquema joshua: ${reason}`);
  for (const table of TABLES) {
    console.log(`[OMITIDO] Existencia y lectura joshua.${table}: ${reason}`);
  }
}

async function main(): Promise<void> {
  try {
    // Same .env* resolution as Next.js; never log loader errors or env contents.
    let envLoadFailed = false;
    loadEnvConfig(process.cwd(), true, {
      info: () => {},
      error: () => { envLoadFailed = true; },
    });
    if (envLoadFailed) throw new DatabaseConfigError("CONFIG: no se pudieron cargar los archivos de entorno.");

    const connected = await check("Conexion y SELECT 1 AS ok", async () => {
      const pool = await getPool();
      const result = await pool.request().query<{ ok: number }>("SELECT 1 AS ok");
      return result.recordset[0]?.ok === 1;
    });
    if (!connected) {
      console.log("[OMITIDO] DB_NAME() = db_WebDevUMG: conexion no disponible.");
      skippedChecks("conexion no disponible.");
      return;
    }

    const pool = await getPool();
    const correctDatabase = await check("DB_NAME() = db_WebDevUMG", async () => {
      const result = await pool.request().query<{ databaseName: string }>("SELECT DB_NAME() AS databaseName");
      return result.recordset[0]?.databaseName === "db_WebDevUMG";
    });
    if (!correctDatabase) {
      skippedChecks("no se confirmo la base esperada; revisar DB_NAME.");
      return;
    }

    await check("Existe el esquema joshua (visible para este usuario)", async () => {
      const result = await pool.request().query<{ found: number }>(
        "SELECT COUNT(*) AS found FROM sys.schemas WHERE name = N'joshua'",
      );
      return result.recordset[0]?.found === 1;
    });

    for (const table of TABLES) {
      await check(`Existe joshua.${table} (visible para este usuario)`, async () => {
        const result = await pool.request()
          .input("tableName", sql.NVarChar(128), table)
          .query<{ found: number }>(`
            SELECT COUNT(*) AS found
            FROM sys.tables AS t
            INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
            WHERE s.name = N'joshua' AND t.name = @tableName
          `);
        return result.recordset[0]?.found === 1;
      });
      await check(`Lectura sin registros joshua.${table}`, async () => {
        // Identifiers come exclusively from TABLES, never from user input or env.
        // TOP (0) verifies SELECT permission without retrieving personal data.
        const result = await pool.request().query(`SELECT TOP (0) * FROM [joshua].[${table}]`);
        return result.recordset.length === 0;
      });
    }
  } catch (error) {
    failures += 1;
    console.error(`[FALLO] Preparacion: ${describeDatabaseError(error)}`);
  } finally {
    await check("Recursos de conexion cerrados", async () => {
      await closePool();
      return true;
    });
    console.log(failures === 0
      ? "Resultado: todas las comprobaciones pasaron. Solo se ejecutaron consultas SELECT."
      : `Resultado: ${failures} comprobacion(es) fallida(s).`);
    process.exitCode = failures === 0 ? 0 : 1;
  }
}

void main();
