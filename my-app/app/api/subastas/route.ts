import {inventory,savePublication} from "@/lib/auctions";
import {currentUser,requireUser} from "@/lib/auth";import {body,json,failure} from "@/lib/http";
export const runtime="nodejs";
export async function GET(request:Request){try{const u=await currentUser();return json(await inventory(new URL(request.url).searchParams,u?.id??null));}catch(e){return failure(e);}}
export async function POST(request:Request){try{const u=await requireUser();const data=await body(request);const id=await savePublication(u.id,data);return json({id},201);}catch(e){return failure(e);}}

