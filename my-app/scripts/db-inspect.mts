import env from "@next/env";
import { getPool, closePool } from "../lib/db/connection";
import { describeDatabaseError } from "../lib/db/errors";
env.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
try {
 const pool = await getPool();
 const r = await pool.request().query(`
 SELECT t.name AS tabla,c.name AS columna,ty.name AS tipo,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,dc.definition AS valor_predeterminado
 FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id
 JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.default_constraints dc ON c.default_object_id=dc.object_id
 WHERE s.name=N'joshua' AND t.name LIKE N'%[_]1890212310' ORDER BY t.name,c.column_id;
 SELECT t.name AS tabla,ch.definition FROM sys.check_constraints ch JOIN sys.tables t ON t.object_id=ch.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=N'joshua';
 SELECT t.name AS tabla, c.name AS columna,rt.name AS referencia,rc.name AS columna_referencia FROM sys.foreign_key_columns fk JOIN sys.tables t ON t.object_id=fk.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=fk.parent_column_id JOIN sys.tables rt ON rt.object_id=fk.referenced_object_id JOIN sys.columns rc ON rc.object_id=rt.object_id AND rc.column_id=fk.referenced_column_id WHERE s.name=N'joshua';
 SELECT N'marcas' catalogo,id,nombre FROM joshua.marcas_1890212310;
 SELECT N'modelos' catalogo,id,marca_id,nombre FROM joshua.modelos_1890212310;
 SELECT N'tipos' catalogo,id,nombre FROM joshua.tipos_articulo_1890212310;
 SELECT N'transmisiones' catalogo,id,nombre FROM joshua.transmisiones_1890212310;
 SELECT N'combustibles' catalogo,id,nombre FROM joshua.combustibles_1890212310;
 `);
 console.log(JSON.stringify(r.recordsets,null,2));
} catch(e) { console.error(describeDatabaseError(e)); process.exitCode=1; }
finally { await closePool(); }