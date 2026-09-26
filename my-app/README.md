This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Graphify: mapa del codigo

Integracion local de [Graphify](https://github.com/Graphify-Labs/graphify), verificada con `graphifyy==0.9.62` (el paquete oficial lleva doble `y`). Es una herramienta de desarrollo Python, independiente de las dependencias de Next.js.

Para preparar otro equipo con Python 3.10+ y uv:

```powershell
uv tool install graphifyy==0.9.62
graphify install --project --platform codex
```

Ejecutar desde `my-app`:

```powershell
npm.cmd run graphify:build
npm.cmd run graphify:query -- "Home RootLayout"
npm.cmd run graphify:explain -- "Home"
npm.cmd run graphify:update
Start-Process .\graphify-out\graph.html
```

`graphify:build` usa `--code-only`: extraccion AST local, sin claves ni llamadas a modelos. `graphify:update` actualiza el codigo sin costo de API. El alcance no incluye analisis semantico de documentacion o imagenes.

Resultados locales en `graphify-out/` (excluidos de Git):

- `graph.html`: visualizacion interactiva.
- `GRAPH_REPORT.md`: informe de estructura y conexiones.
- `graph.json`: grafo consultable.

`.graphifyignore` excluye `.env*`, claves, dependencias, compilaciones y configuracion de asistentes. No agregues credenciales al codigo fuente. La configuracion de Codex esta en `.codex/skills/graphify/`, `.codex/hooks.json` y `AGENTS.md`; indica consultar el grafo antes de responder preguntas sobre el codigo y actualizarlo despues de cambios.

## Fase 0: conexion SQL Server (solo servidor)

El modulo `lib/db/connection.ts` usa `mssql` y esta protegido con `server-only`.
`getPool()` comparte el pool y la promesa de conexion entre solicitudes, incluso
con recargas de desarrollo. Una conexion inicial fallida libera sus recursos y
permite reintentar en la siguiente llamada. `closePool()` se usa al terminar un
proceso, no despues de cada solicitud. Requiere el runtime Node.js, no Edge.

Usa las variables existentes `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME` y `DB_TRUST_SERVER_CERTIFICATE`. No hay variables `NEXT_PUBLIC_`.
El cifrado esta activado (`encrypt: true`); la confianza del certificado respeta
`DB_TRUST_SERVER_CERTIFICATE` (`true`/`false` o `1`/`0`). No se cambia ninguna
opcion automaticamente cuando falla una conexion.

Desde `my-app`, en PowerShell:

```powershell
npm.cmd run typecheck
npm.cmd run test:db
npm.cmd run db:check
```

`db:check` carga `.env*` mediante `@next/env`, con la misma prioridad de Next.js
en desarrollo (las variables ya presentes en el proceso tienen prioridad).
No modifica esos archivos. El comando usa `--conditions=react-server` solamente
en su proceso Node para poder reutilizar el modulo protegido con `server-only`.

La prueba ejecuta exclusivamente SELECT: comprueba conectividad, `DB_NAME()`,
el esquema `joshua`, la existencia de las diez tablas de la lista fija con sufijo
`_1890212310` y permisos SELECT mediante `SELECT TOP (0) *` sobre cada tabla.
No obtiene registros ni muestra valores de conexion o errores crudos del driver.
Si la base no es `db_WebDevUMG`, omite las consultas de tablas. Las comprobaciones
de existencia dependen de la visibilidad de metadatos del usuario conectado.
Cierra el pool en `finally` y devuelve codigo 1 si alguna comprobacion falla.

`test:db` usa conexiones simuladas, sin contactar la base compartida: comprueba
concurrencia, reintento, cierre, validacion de variables y diagnosticos sin secretos.
Esta fase no agrega rutas HTTP, interfaz, autenticacion ni operaciones de escritura.
