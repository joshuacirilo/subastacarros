import "server-only";
import sql from "mssql";
import { DatabaseConfigError, describeDatabaseError } from "./errors";

// Next.js uses local .env files in development; Vercel injects these values
// into process.env for each deployment. Never copy secrets into vercel.json.
function databaseEnvironment() {
  const variables = {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_TRUST_SERVER_CERTIFICATE: process.env.DB_TRUST_SERVER_CERTIFICATE,
  };
  const missing = Object.entries(variables)
    .filter(([, value]) => value === undefined || value.length === 0)
    .map(([name]) => name);
  if (missing.length) {
    throw new DatabaseConfigError(
      `CONFIG: faltan variables de entorno: ${missing.join(", ")}.`,
    );
  }
  return variables as Record<keyof typeof variables, string>;
}

function connectionConfig(): sql.config {
  const env = databaseEnvironment();
  const portText = env.DB_PORT;
  const port = Number(portText);
  if (
    !/^\d+$/.test(portText) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new DatabaseConfigError(
      "CONFIG: DB_PORT debe ser un puerto entre 1 y 65535.",
    );
  }
  const trust = env.DB_TRUST_SERVER_CERTIFICATE.trim().toLowerCase();
  if (!["true", "false", "1", "0"].includes(trust)) {
    throw new DatabaseConfigError(
      "CONFIG: DB_TRUST_SERVER_CERTIFICATE debe ser true, false, 1 o 0.",
    );
  }
  return {
    server: env.DB_HOST,
    port,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
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
const dbGlobal = globalThis as typeof globalThis & {
  __subastacarrosSqlPool?: PoolState;
};
const state = (dbGlobal.__subastacarrosSqlPool ??= {});

export async function getPool(): Promise<sql.ConnectionPool> {
  if (state.closing) await state.closing;
  if (!state.connection) {
    state.connection = Promise.resolve()
      .then(async () => {
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
            console.error(
              `[DB] Cierre tras fallo: ${describeDatabaseError(closeError)}`,
            );
          }
          throw error;
        }
      })
      .catch((error: unknown) => {
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
