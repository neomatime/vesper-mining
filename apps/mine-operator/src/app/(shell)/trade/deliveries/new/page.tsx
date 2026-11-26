/**
 * Route page. The screen reads the address's query (the agreement to plan against), so it renders inside Suspense.
 */
import { Suspense } from "react";
import { NewDeliveryScreen } from "@/components/trade/delivery-plan-form";

export default function Page() {
  return <Suspense><NewDeliveryScreen /></Suspense>;
}
