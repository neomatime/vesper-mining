/**
 * Route page. The screen reads the address's query (for example a filter or a record to open), so it renders inside Suspense.
 */
import { Suspense } from "react";
import { AgreementsScreen } from "@/components/trade/trade-commercial";

export default function Page() {
  return <Suspense><AgreementsScreen /></Suspense>;
}
