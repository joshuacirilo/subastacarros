import AuctionDetail from "@/components/auction-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AuctionDetail id={(await params).id} />;
}
