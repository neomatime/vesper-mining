/**
 * Route page. Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { TradeReportScreen } from "@/components/trade/trade-reports";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TradeReportScreen id={id} />;
}
