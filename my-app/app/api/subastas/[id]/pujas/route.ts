import {placeBid,auctionState} from "@/lib/auctions";import {requireUser} from "@/lib/auth";import {body,json,failure} from "@/lib/http";import {id,object} from "@/lib/validation";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const u=await requireUser(),auctionId=id((await params).id),data=object(await body(request));await placeBid(auctionId,u.id,data.monto);return json(await auctionState(auctionId,u.id),201);}catch(e){return failure(e);}}

