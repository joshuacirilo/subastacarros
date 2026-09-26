import "server-only";
import sql from "mssql";
import { DatabaseConfigError, describeDatabaseError } from "./errors";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new DatabaseConfigError(`CONFIG: falta la variable ${name}.`);
  }
  return value;
}

function connectionConfig(): sql.config {
  const portText = required("DB_PORT");
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new DatabaseConfigError("CONFIG: DB_PORT debe ser un puerto entre 1 y 65535.");
  }
  const trust = required("DB_TRUST_SERVER_CERTIFICATE").trim().toLowerCase();
  if (!["true", "false", "1", "0"].includes(trust)) {
    throw new DatabaseConfigError("CONFIG: DB_TRUST_SERVER_CERTIFICATE debe ser true, false, 1 o 0.");
  }
  return {
    server: required("DB_HOST"),
    port,
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    database: required("DB_NAME"),
    connectionTimeout: 15_000,
    requestTimeout: 15_000,
    options: {
      encrypt: true,
      trustServerCertificate: trust === "true" || trust === "1",
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
  };
}

type PoolState = {
  connection?: Promise<sql.ConnectionPool>;
  closing?: Promise<void>;
};

// Survives Next.js development reloads and shares in-flight connection attempts.
const dbGlobal = globalThis as typeof globalThis & { __subastacarrosSqlPool?: PoolState };
const state = dbGlobal.__subastacarrosSqlPool ??= {};

export async function getPool(): Promise<sql.ConnectionPool> {
  if (state.closing) await state.closing;
  if (!state.connection) {
    state.connection = Promise.resolve().then(async () => {
      const pool = new sql.ConnectionPool(connectionConfig());
      pool.on("error", (error: Error) => {
        console.error(`[DB] ${describeDatabaseError(error)}`);
      });
      try {
        return await pool.connect();
      } catch (error) {
        // Release partial resources before allowing another attempt.
        try {
          await pool.close();
        } catch (closeError) {
          console.error(`[DB] Cierre tras fallo: ${describeDatabaseError(closeError)}`);
        }
        throw error;
      }
    }).catch((error: unknown) => {
      state.connection = undefined;
      throw error;
    });
  }
  return state.connection;
}

// Only at process shutdown, never after each application request.
export async function closePool(): Promise<void> {
  if (state.closing) return state.closing;
  const pending = state.connection;
  if (!pending) return;
  state.closing = (async () => {
    let pool: sql.ConnectionPool;
    try {
      pool = await pending;
    } catch {
      return; // getPool already cleaned up a failed initial connection.
    }
    await pool.close();
  })().finally(() => {
    state.connection = undefined;
    state.closing = undefined;
  });
  return state.closing;
}
