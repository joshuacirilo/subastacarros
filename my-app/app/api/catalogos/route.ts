import {catalogs} from "@/lib/auctions";import {json,failure} from "@/lib/http";
export const runtime="nodejs";
export async function GET(){try{return json(await catalogs());}catch(e){return failure(e);}}

