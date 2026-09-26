# SubastaGT — plataforma de subastas de vehículos

**Sitio público: pendiente de desplegar en Vercel.** No se ha subido código a GitHub ni publicado desde esta sesión. Sustituir esta línea por el enlace HTTPS real después del despliegue.

Aplicación **Next.js 16 / App Router + TypeScript + SQL Server**. Todo el backend vive en Route Handlers de Next.js; no hay un servidor adicional. Base existente `db_WebDevUMG`, esquema `joshua`, tablas con sufijo `_1890212310`. No se cambió el esquema.

## Cuentas de demostración

Estas tres cuentas ya fueron creadas y verificadas. La contraseña siguiente es **exclusiva de demostración** y se publica por requisito del examen; SQL Server conserva únicamente hashes scrypt con sal individual.

| Cuenta     | Correo                            | Contraseña demo   |
| ---------- | --------------------------------- | ----------------- |
| Publicador | demo.publicador@subastagt.example | DemoUMG!2026-1890 |
| Postor uno | demo.postor1@subastagt.example    | DemoUMG!2026-1890 |
| Postor dos | demo.postor2@subastagt.example    | DemoUMG!2026-1890 |

No son roles: cualquiera puede publicar y pujar. Para recrearlas de forma idempotente junto a los catálogos básicos: `npm run seed:demo`. El comando no reemplaza contraseñas de usuarios existentes.

## Ejecutar en local

Desde `my-app`, con Node.js 24 y npm:

```powershell
npm.cmd ci
npm.cmd run setup:session
npm.cmd run db:check
npm.cmd run dev
```

Abrir http://localhost:3000. En PowerShell se usa `npm.cmd` para no depender de la política de ejecución de `npm.ps1`; en otras terminales se puede usar `npm`.

La conexión reutiliza las variables existentes, sin valores públicos:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_TRUST_SERVER_CERTIFICATE`
- `SESSION_SECRET`: clave aleatoria independiente para firmar sesiones. Se generó localmente en `.env.local`, ignorado por Git. `setup:session` no sobrescribe una clave existente ni imprime su valor.

`.env` no fue reemplazado. El driver usa cifrado TLS y respeta la confianza de certificado configurada, sin cambiar opciones automáticamente. Los módulos de SQL y autenticación están protegidos con `server-only`.

## Funcionalidad

- Registro, inicio y cierre de sesión; cookies HttpOnly, SameSite=Lax y Secure en producción; sesiones firmadas con vencimiento de 8 horas.
- Inventario público con búsqueda y filtros combinables por marca, modelo, año, combustible y daño.
- Ficha completa, condición por color y carrusel.
- Publicación de vehículo, fotos y subasta en una sola transacción. La marca y el modelo deben corresponder.
- Entre 5 y 20 URL HTTPS diferentes por publicación, guardadas con orden. **El propietario del proyecto poblará las imágenes**; se usan enlaces permanentes de su almacenamiento y se muestran directamente desde ese proveedor. No se guardan archivos en el disco efímero de Vercel.
- Mis publicaciones: consulta propia y edición antes del inicio, sin ofertas. El servidor comprueba propiedad y bloqueo.
- Fecha de formulario en Guatemala (UTC−6), convertida a UTC; horario de aceptación comprobado con `SYSUTCDATETIME()`.
- Primera oferta igual o mayor a la base. Después, mínimo = oferta más alta × 1.10, redondeado hacia arriba al centavo. Cálculo monetario con enteros, sin aritmética de punto flotante.
- Bloqueo `UPDLOCK, HOLDLOCK` de la fila de la subasta durante validación e inserción. Las pujas aceptadas solo se insertan; no existe endpoint para editarlas o eliminarlas.
- Actualización automática cada 2 segundos en el detalle (10 segundos con pestaña oculta), temporizador cada segundo y avisos de ganador/superado. Todas las instancias consultan SQL Server; no hay estado de subastas en memoria ni proceso permanente.
- Cierre sin cron: se deriva del reloj SQL. Se rechaza una oferta al llegar al cierre. Sin pujas se muestra “No vendida / desierta”.
- Las respuestas públicas nunca incluyen nombre, correo o identificador de otros postores.

## Verificaciones

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run db:check
npm.cmd run build
```

Prueba de navegador contra el servidor local ya iniciado:

```powershell
$env:E2E_ALLOW_WRITES = "1"
npm.cmd run test:e2e
```

La prueba E2E abre sesiones independientes en Edge en Windows (Chromium en otros sistemas). Fuera de Windows, instalar antes `npx playwright install chromium`. Comprueba formularios, filtros, permisos, dos postores en simultáneo, carrera de pujas y cierre en escritorio. **Crea publicaciones de demostración identificadas con motor `E2E-...` y conserva las pujas aceptadas sin alterarlas.** Las imágenes de esas publicaciones de prueba son ilustrativas. No usar esas cuentas para actividad real.

`db:check` sigue siendo exclusivamente de lectura, cierra el pool y devuelve código 1 ante cualquier fallo. `npm test` usa simulaciones o funciones puras, sin escribir en la base compartida. Evidencia de navegador local en `test-results/` y `playwright-report/`, excluidos de Git.

## Desplegar en Vercel (lo realiza el propietario)

1. Subir el repositorio a GitHub cuando decidas hacerlo; este agente no hizo push.
2. Importar en Vercel y elegir **Root Directory: `my-app`**, Framework: **Next.js**, Node.js **24.x**, Install Command: `npm ci`, Build Command: `npm run build`.
3. Configurar en Vercel las seis variables SQL existentes y `SESSION_SECRET` como variables privadas para los entornos que usarás. Copiar sus valores de forma segura, sin agregar `.env` a Git. La clave de sesión debe ser igual entre instancias de un mismo despliegue y tener al menos 32 bytes aleatorios.
4. Confirmar que el servidor SQL acepta conexiones TCP desde Vercel y que el certificado coincide con la configuración. El build no prueba acceso a SQL; comprobarlo después del despliegue con catálogo, login y publicación.
5. Abrir dos navegadores en el sitio HTTPS, pujar con usuarios demo distintos y revisar monto, ganador/superado, cierre y que las cinco URL de cada publicación carguen sin autenticación.
6. Reemplazar el aviso de “Sitio público pendiente” al inicio de este README por el enlace publicado.

No hay acceso autenticado a Vercel ni proyecto vinculado en este entorno. Por eso no hay URL pública verificada y no se considera completado el punto de publicación hasta ese paso externo.

Referencias: [Next.js en Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Node.js soportado en Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [bloqueos SQL Server](https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-table).

## Organización

- `app/`: páginas Next.js y endpoints `app/api/`.
- `components/`: formularios, inventario, galería y seguimiento en vivo.
- `lib/db/`: conexión reutilizable y transacciones.
- `lib/auth.ts`, `lib/password.ts`: autenticación del servidor.
- `lib/auctions.ts`: consultas y escrituras limitadas a las tablas del proyecto.
- `lib/domain.ts`, `lib/validation.ts`: contratos, dinero, fechas y validación.
- `tests/`: pruebas unitarias y E2E.

## Graphify

El grafo local se excluye de Git. Comandos desde `my-app`:

```powershell
npm.cmd run graphify:build
npm.cmd run graphify:query -- "placeBid savePublication getPool"
npm.cmd run graphify:update
```

Graphify analiza código localmente con `--code-only`; `.graphifyignore` excluye secretos, dependencias y compilaciones. En otro equipo: `uv tool install graphifyy==0.9.62`.
