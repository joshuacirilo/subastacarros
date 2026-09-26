import {loadEnvConfig} from "@next/env";
import sql from "mssql";
import {getPool,closePool} from "../lib/db/connection";
import {transaction} from "../lib/db/transaction";
import {register,login} from "../lib/auth";
import {describeDatabaseError} from "../lib/db/errors";
loadEnvConfig(process.cwd(),true,{info(){},error(){}});
async function main(){
 try{
 await transaction(async tx=>{
  const lists=[
   ["marcas_1890212310",["Toyota","Honda"]],
   ["tipos_articulo_1890212310",["Sedán","SUV","Pickup"]],
   ["transmisiones_1890212310",["Automática","Manual"]],
   ["combustibles_1890212310",["Gasolina","Diésel","Eléctrico"]],
  ] as const;
  for(const [table,names] of lists)for(const name of names)await tx.request().input("name",sql.NVarChar(100),name).query(`IF NOT EXISTS(SELECT 1 FROM joshua.[${table}] WITH(UPDLOCK,HOLDLOCK) WHERE nombre=@name) INSERT INTO joshua.[${table}](nombre) VALUES(@name)`);
  for(const [brand,model] of [["Toyota","Corolla"],["Toyota","RAV4"],["Honda","Civic"],["Honda","CR-V"]]){
   await tx.request().input("brand",sql.NVarChar(100),brand).input("model",sql.NVarChar(100),model).query(`DECLARE @brandId int=(SELECT TOP(1) id FROM joshua.marcas_1890212310 WHERE nombre=@brand); IF NOT EXISTS(SELECT 1 FROM joshua.modelos_1890212310 WITH(UPDLOCK,HOLDLOCK) WHERE marca_id=@brandId AND nombre=@model) INSERT INTO joshua.modelos_1890212310(marca_id,nombre) VALUES(@brandId,@model)`);
  }
 });
 console.log("[OK] Catálogos de demostración disponibles.");
 const accounts=[["Publicador","demo.publicador@subastagt.example"],["Postor Uno","demo.postor1@subastagt.example"],["Postor Dos","demo.postor2@subastagt.example"]];
 for(const [nombre,correo] of accounts){
  const found=await(await getPool()).request().input("correo",sql.NVarChar(254),correo).query("SELECT id FROM joshua.usuarios_1890212310 WHERE correo=@correo");
  if(!found.recordset.length)await register({nombre,apellido:"Demo UMG",correo,telefono:"55550000",password:"DemoUMG!2026-1890"});
  await login({correo,password:"DemoUMG!2026-1890"});
 }
 console.log("[OK] Tres cuentas demo funcionales. Contraseñas de demostración documentadas en README.");
 }catch(e){console.error(describeDatabaseError(e));process.exitCode=1;}finally{await closePool();}
}
void main();

