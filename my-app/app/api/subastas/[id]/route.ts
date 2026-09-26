import {inventory,savePublication} from "@/lib/auctions";import {currentUser,requireUser} from "@/lib/auth";import {body,json,failure} from "@/lib/http";import {id} from "@/lib/validation";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){try{const u=await currentUser();const r=await inventory(new URLSearchParams(),u?.id??null,id((await params).id));return json(r.items[0]);}catch(e){return failure(e);}}
export async function PATCH(request:Request,{params}:Context){try{const u=await requireUser();return json({id:await savePublication(u.id,await body(request),id((await params).id))});}catch(e){return failure(e);}}

