import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import sql from "mssql";
import { getPool } from "./db/connection";
import { transaction } from "./db/transaction";
import { hashPassword, verifyPassword } from "./password";
import { AppError, type User } from "./domain";
import { object,text,email,password } from "./validation";
const COOKIE="subastagt_session", TTL=8*3600;
function secret():string {
 const key=process.env.SESSION_SECRET;
 if(!key||Buffer.byteLength(key)<32) throw new AppError("Falta configurar SESSION_SECRET en el servidor.",503);
 return key;
}
function sign(payload:string):string { return createHmac("sha256",secret()).update(payload).digest("base64url"); }
export async function setSession(userId:number):Promise<void> {
 const payload=Buffer.from(JSON.stringify({id:userId,exp:Math.floor(Date.now()/1000)+TTL,nonce:randomBytes(16).toString("hex")})).toString("base64url");
 (await cookies()).set(COOKIE,payload+"."+sign(payload),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:TTL});
}
export async function clearSession():Promise<void> { (await cookies()).set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0}); }
export async function currentUser():Promise<User|null> {
 const token=(await cookies()).get(COOKIE)?.value; if(!token||token.length>1024) return null;
 const [payload,signature,...extra]=token.split("."); if(!payload||!signature||extra.length) return null;
 const expected=Buffer.from(sign(payload)),received=Buffer.from(signature);
 if(expected.length!==received.length||!timingSafeEqual(expected,received)) return null;
 let data:{id:number;exp:number};
 try { data=JSON.parse(Buffer.from(payload,"base64url").toString()); } catch {return null;}
 if(!Number.isSafeInteger(data.id)||data.id<1||!Number.isSafeInteger(data.exp)||data.exp<=Date.now()/1000) return null;
 const r=await (await getPool()).request().input("id",sql.Int,data.id).query<User>("SELECT id,nombre,apellido FROM joshua.usuarios_1890212310 WHERE id=@id");
 return r.recordset[0]??null;
}
export async function requireUser():Promise<User> {const u=await currentUser();if(!u)throw new AppError("Inicia sesión para continuar.",401);return u;}
export async function register(value:unknown):Promise<User> {
 secret(); const v=object(value), correo=email(v.correo), pass=password(v.password);
 const nombre=text(v.nombre,"Nombre",100),apellido=text(v.apellido,"Apellido",100),telefono=text(v.telefono,"Teléfono",25,8);
 if(!/^[+\d\s()-]+$/.test(telefono))throw new AppError("Teléfono inválido.");
 const hash=await hashPassword(pass);
 return transaction(async tx=>{
  const existing=await tx.request().input("correo",sql.NVarChar(254),correo).query("SELECT id FROM joshua.usuarios_1890212310 WITH (UPDLOCK,HOLDLOCK) WHERE correo=@correo");
  if(existing.recordset.length)throw new AppError("No se pudo registrar este correo. Intenta iniciar sesión.",409);
  const r=await tx.request().input("nombre",sql.NVarChar(100),nombre).input("apellido",sql.NVarChar(100),apellido).input("correo",sql.NVarChar(254),correo).input("telefono",sql.NVarChar(25),telefono).input("hash",sql.NVarChar(255),hash).query<User>("INSERT INTO joshua.usuarios_1890212310(nombre,apellido,correo,telefono,password_hash) OUTPUT inserted.id,inserted.nombre,inserted.apellido VALUES(@nombre,@apellido,@correo,@telefono,@hash)");
  return r.recordset[0];
 });
}
export async function login(value:unknown):Promise<User> {
 secret();const v=object(value),correo=email(v.correo),pass=password(v.password);
 const r=await(await getPool()).request().input("correo",sql.NVarChar(254),correo).query<User & {password_hash:string}>("SELECT id,nombre,apellido,password_hash FROM joshua.usuarios_1890212310 WHERE correo=@correo");
 const row=r.recordset[0];
 const dummy="scrypt$"+"0".repeat(32)+"$"+"0".repeat(128);
 const valid=await verifyPassword(pass,row?.password_hash??dummy);
 if(!row||!valid)throw new AppError("Correo o contraseña incorrectos.",401);
 return {id:row.id,nombre:row.nombre,apellido:row.apellido};
}

