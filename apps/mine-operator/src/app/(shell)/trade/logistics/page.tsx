/**
 * Route page. The screen reads the address's query (for example a filter or a record to open), so it renders inside Suspense.
 */
import { Suspense } from "react";
import { LogisticsScreen } from "@/components/trade/trade-logistics";

export default function Page() {
  return <Suspense><LogisticsScreen /></Suspense>;
}
