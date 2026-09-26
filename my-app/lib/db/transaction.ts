import "server-only";
import sql from "mssql";
import { getPool } from "./connection";
export async function transaction<T>(operation:(tx:sql.Transaction)=>Promise<T>):Promise<T> {
 const tx=new sql.Transaction(await getPool()); let rolledBack=false;
 tx.on("rollback",()=>{rolledBack=true;});
 await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
 try { const result=await operation(tx); await tx.commit(); return result; }
 catch(error) { if(!rolledBack) { try{await tx.rollback();}catch{} } throw error; }
}

