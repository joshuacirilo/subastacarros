import { AppError, guatemalaDate, moneyCents, decimal } from "./domain";
export function object(value: unknown): Record<string, unknown> {
 if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("Solicitud inválida.");
 return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max: number, min=1): string {
 if (typeof value !== "string" || value.trim().length<min || value.trim().length>max) throw new AppError(`${label}: usa entre ${min} y ${max} caracteres.`);
 return value.trim();
}
export function id(value: unknown): number {
 const n=Number(value);
 if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(n) || n>2147483647) throw new AppError("Identificador inválido.");
 return n;
}
export function password(value: unknown): string {
 if (typeof value !== "string" || value.length<12 || value.length>128) throw new AppError("La contraseña debe tener entre 12 y 128 caracteres.");
 return value;
}
export function email(value: unknown): string {
 const s=text(value,"Correo",254).toLowerCase();
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new AppError("Ingresa un correo válido.");
 return s;
}
export function publication(value: unknown) {
 const v=object(value);
 const year=Number(v.anio), cylinders=Number(v.numero_cilindros);
 if (!Number.isInteger(year)||year<1900||year>new Date().getUTCFullYear()+2) throw new AppError("Año inválido.");
 if (!Number.isInteger(cylinders)||cylinders<0||cylinders>16) throw new AppError("Cilindros: usa un número entre 0 y 16.");
 const drive=text(v.tren_manejo,"Tren de manejo",3), damage=text(v.nivel_dano,"Daño",8);
 if (!["AWD","FWD","RWD","4WD"].includes(drive)||!["VERDE","AMARILLO","ROJO"].includes(damage)) throw new AppError("Clasificación inválida.");
 if (!Array.isArray(v.photos)||v.photos.length<5||v.photos.length>20) throw new AppError("Agrega entre 5 y 20 fotografías.");
 const photos=v.photos.map((p:unknown)=>{
  const s=text(p,"URL de fotografía",2048); let url: URL;
  try { url=new URL(s); } catch { throw new AppError("URL de fotografía inválida."); }
  if(url.protocol!=="https:"||url.username||url.password) throw new AppError("Las fotografías deben usar URL HTTPS públicas, sin credenciales.");
  return url.href;
 });
 if(new Set(photos).size!==photos.length) throw new AppError("Usa fotografías con URL diferentes.");
 const starts=guatemalaDate(v.inicia_en), ends=guatemalaDate(v.finaliza_en);
 if(ends<=starts) throw new AppError("El cierre debe ser posterior al inicio.");
 return {marca_id:id(v.marca_id),modelo_id:id(v.modelo_id),tipo_articulo_id:id(v.tipo_articulo_id),transmision_id:id(v.transmision_id),combustible_id:id(v.combustible_id),anio:year,motor:text(v.motor,"Motor",150),tren_manejo:drive,numero_cilindros:cylinders,nivel_dano:damage,photos,starts,ends,base:decimal(moneyCents(v.monto_base))};
}

