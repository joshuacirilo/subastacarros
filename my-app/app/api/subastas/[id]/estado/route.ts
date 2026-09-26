import { auctionState } from "@/lib/auctions";
import { currentUser } from "@/lib/auth";
import { json, failure } from "@/lib/http";
import { id } from "@/lib/validation";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await currentUser();
    return json(await auctionState(id((await params).id), u?.id ?? null));
  } catch (e) {
    return failure(e);
  }
}
