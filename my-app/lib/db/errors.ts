import "server-only";

export class DatabaseConfigError extends Error {}

// Never expose raw driver messages: they can include user/server names.
export function describeDatabaseError(error: unknown): string {
  if (error instanceof DatabaseConfigError) return error.message;
  const causes: string[] = [];
  const visited = new Set<unknown>();
  function collect(value: unknown): void {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    const item = value as Record<string, unknown>;
    if (typeof item.code === "string") causes.push(item.code);
    if (typeof item.number === "number") causes.push(String(item.number));
    if (typeof item.message === "string") causes.push(item.message);
    collect(item.cause);
    collect(item.originalError);
    collect(item.info);
    if (Array.isArray(item.errors)) item.errors.forEach(collect);
    if (Array.isArray(item.precedingErrors))
      item.precedingErrors.forEach(collect);
  }
  collect(error);
  const details = causes.join(" ");
  const known: [RegExp, string][] = [
    [
      /ERR_TLS_CERT_ALTNAME_INVALID/i,
      "ERR_TLS_CERT_ALTNAME_INVALID: el certificado no corresponde al servidor.",
    ],
    [
      /CERT_HAS_EXPIRED|certificate has expired/i,
      "CERT_HAS_EXPIRED: el certificado TLS ha caducado.",
    ],
    [
      /SELF_SIGNED|self.signed|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER/i,
      "TLS: no se pudo verificar la cadena de confianza del certificado.",
    ],
    [/ENOTFOUND/, "ENOTFOUND: no se pudo resolver el nombre del servidor."],
    [/ECONNREFUSED/, "ECONNREFUSED: el servidor o puerto rechazo la conexion."],
    [
      /ECONNRESET|socket hang up/i,
      "ECONNRESET: la conexion fue interrumpida por el servidor o la red.",
    ],
    [
      /EHOSTUNREACH|ENETUNREACH/,
      "RED_INACCESIBLE: no hay ruta de red hacia el servidor.",
    ],
    [
      /ETIMEOUT|ETIMEDOUT/,
      "ETIMEOUT: se agoto el tiempo de conexion o de consulta.",
    ],
    [
      /\b4060\b/,
      "SQL 4060: no se pudo abrir la base solicitada; revisar existencia y permisos.",
    ],
    [
      /ELOGIN|\b18456\b/,
      "ELOGIN: SQL Server rechazo el inicio de sesion; revisar credenciales y permisos.",
    ],
    [/\b229\b/, "SQL 229: permiso de lectura denegado."],
    [
      /\b208\b/,
      "SQL 208: el objeto no existe o no es visible para este usuario.",
    ],
    [/\b207\b/, "SQL 207: la columna solicitada no existe."],
    [
      /ECONNCLOSED|ENOTOPEN/,
      "CONEXION_CERRADA: la conexion no esta disponible.",
    ],
    [
      /TLS|SSL|certificate/i,
      "TLS: fallo de cifrado o certificado; revisar la configuracion sin desactivar validaciones automaticamente.",
    ],
    [/ESOCKET/, "ESOCKET: fallo de transporte al conectar con SQL Server."],
    [
      /EREQUEST/,
      "EREQUEST: SQL Server rechazo la consulta; revisar objetos y permisos.",
    ],
  ];
  return (
    known.find(([pattern]) => pattern.test(details))?.[1] ??
    "ERROR_DB: fallo no clasificado; se omitio el mensaje original para proteger las credenciales."
  );
}
