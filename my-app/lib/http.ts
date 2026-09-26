import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "./domain";
import { describeDatabaseError } from "./db/errors";
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie",
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return json({ error: error.message }, error.status);
  console.error("[API] " + describeDatabaseError(error));
  return json(
    { error: "No fue posible completar la operación. Inténtalo nuevamente." },
    503,
  );
}
export async function body(request: Request): Promise<unknown> {
  const origin = request.headers.get("origin");
  if (!origin) throw new AppError("Origen de solicitud no permitido.", 403);
  const source = new URL(origin);
  if (
    source.origin !== origin ||
    source.host !== request.headers.get("host") ||
    ![
      "https:",
      ...(process.env.NODE_ENV !== "production" ? ["http:"] : []),
    ].includes(source.protocol)
  )
    throw new AppError("Origen de solicitud no permitido.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("Se requiere JSON.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 64000)
    throw new AppError("Solicitud demasiado grande.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Solicitud vacía.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 64000) {
        await reader.cancel();
        throw new AppError("Solicitud demasiado grande.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("JSON inválido.");
  }
}
