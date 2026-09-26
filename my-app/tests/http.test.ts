import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { failure } from "../lib/http";
import { DatabaseConfigError } from "../lib/db/errors";

test("API exposes only safe missing-variable diagnostics", async () => {
  const log = mock.method(console, "error", () => {});
  try {
    const response = failure(new DatabaseConfigError("CONFIG: faltan variables de entorno: DB_HOST, DB_PASSWORD."));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, "DB_CONFIG");
    assert.match(body.error, /DB_HOST, DB_PASSWORD/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  } finally { log.mock.restore(); }
});

test("API does not expose raw SQL login errors or secrets", async () => {
  const log = mock.method(console, "error", () => {});
  try {
    const response = failure(Object.assign(new Error("secret-password at private-server"), { code: "ELOGIN" }));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(body), /secret-password|private-server/);
    assert.match(String(log.mock.calls[0].arguments[0]), /ELOGIN/);
    assert.doesNotMatch(String(log.mock.calls[0].arguments[0]), /secret-password|private-server/);
  } finally { log.mock.restore(); }
});
