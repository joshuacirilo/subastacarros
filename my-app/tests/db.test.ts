import assert from "node:assert/strict";
import { afterEach, beforeEach, test, mock } from "node:test";
import sql from "mssql";
import { closePool, getPool } from "../lib/db/connection";
import { describeDatabaseError } from "../lib/db/errors";

const testEnv = {
  DB_HOST: "test.invalid",
  DB_PORT: "1433",
  DB_USER: "test-user",
  DB_PASSWORD: "test-password",
  DB_NAME: "test-database",
  DB_TRUST_SERVER_CERTIFICATE: "false",
};
let original: Record<string, string | undefined>;

beforeEach(() => {
  original = Object.fromEntries(
    Object.keys(testEnv).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, testEnv);
});

afterEach(async () => {
  await closePool();
  mock.restoreAll();
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("concurrent callers share one connection attempt and one pool", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const connect = mock.method(
    sql.ConnectionPool.prototype,
    "connect",
    async function (this: sql.ConnectionPool) {
      await gate;
      return this;
    },
  );
  const close = mock.method(
    sql.ConnectionPool.prototype,
    "close",
    async () => {},
  );
  const calls = Array.from({ length: 12 }, () => getPool());
  await Promise.resolve();
  assert.equal(connect.mock.callCount(), 1);
  release();
  const pools = await Promise.all(calls);
  assert.ok(pools.every((pool) => pool === pools[0]));
  assert.equal(
    (pools[0] as sql.ConnectionPool & { config: sql.config }).config.options
      ?.encrypt,
    true,
  );
  assert.equal(
    (pools[0] as sql.ConnectionPool & { config: sql.config }).config.options
      ?.trustServerCertificate,
    false,
  );
  await Promise.all([closePool(), closePool()]);
  assert.equal(close.mock.callCount(), 1);
});

test("failed initial connection is cleaned up and a later call can retry", async () => {
  let attempts = 0;
  const connect = mock.method(
    sql.ConnectionPool.prototype,
    "connect",
    async function (this: sql.ConnectionPool) {
      attempts += 1;
      if (attempts === 1)
        throw Object.assign(new Error("synthetic login failure"), {
          code: "ELOGIN",
        });
      return this;
    },
  );
  const close = mock.method(
    sql.ConnectionPool.prototype,
    "close",
    async () => {},
  );
  const first = await Promise.allSettled([getPool(), getPool()]);
  assert.ok(first.every((result) => result.status === "rejected"));
  assert.equal(connect.mock.callCount(), 1);
  assert.equal(close.mock.callCount(), 1);
  await getPool();
  assert.equal(connect.mock.callCount(), 2);
  await closePool();
  assert.equal(close.mock.callCount(), 2);
});

test("getPool waits for shutdown before creating another pool", async () => {
  mock.method(
    sql.ConnectionPool.prototype,
    "connect",
    async function (this: sql.ConnectionPool) {
      return this;
    },
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const close = mock.method(sql.ConnectionPool.prototype, "close", async () => {
    await gate;
  });
  const oldPool = await getPool();
  const closing = closePool();
  let resolved = false;
  const reopening = getPool().then((pool) => {
    resolved = true;
    return pool;
  });
  await Promise.resolve();
  assert.equal(resolved, false);
  release();
  await closing;
  assert.notEqual(await reopening, oldPool);
  assert.equal(close.mock.callCount(), 1);
});

test("invalid configuration fails without opening a connection and can be corrected", async () => {
  const connect = mock.method(
    sql.ConnectionPool.prototype,
    "connect",
    async function (this: sql.ConnectionPool) {
      return this;
    },
  );
  mock.method(sql.ConnectionPool.prototype, "close", async () => {});
  process.env.DB_PORT = "invalid-secret-value";
  await assert.rejects(getPool(), /DB_PORT debe ser/);
  assert.equal(connect.mock.callCount(), 0);
  process.env.DB_PORT = "1433";
  process.env.DB_TRUST_SERVER_CERTIFICATE = "not-a-boolean";
  await assert.rejects(getPool(), /DB_TRUST_SERVER_CERTIFICATE debe ser/);
  assert.equal(connect.mock.callCount(), 0);
  process.env.DB_TRUST_SERVER_CERTIFICATE = "true";
  const pool = await getPool();
  assert.equal(
    (pool as sql.ConnectionPool & { config: sql.config }).config.options
      ?.trustServerCertificate,
    true,
  );
  assert.equal(
    (pool as sql.ConnectionPool & { config: sql.config }).config.options
      ?.encrypt,
    true,
  );
});

test("diagnostics report nested causes without exposing raw credentials or server names", () => {
  const error = Object.assign(
    new Error("secret-user at secret-host with secret-password"),
    {
      code: "ESOCKET",
      originalError: {
        cause: { code: "ECONNREFUSED", message: "secret-host" },
      },
    },
  );
  const result = describeDatabaseError(error);
  assert.match(result, /^ECONNREFUSED:/);
  assert.doesNotMatch(result, /secret-/);
  assert.match(
    describeDatabaseError({ code: "EREQUEST", number: 229 }),
    /^SQL 229:/,
  );
  assert.match(
    describeDatabaseError({ code: "CERT_HAS_EXPIRED" }),
    /^CERT_HAS_EXPIRED:/,
  );
  assert.doesNotMatch(
    describeDatabaseError(new Error("secret-password")),
    /secret-password/,
  );
});
