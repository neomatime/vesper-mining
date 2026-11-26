/**
 * Route page. Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { Suspense } from "react";
import { EditDeliveryPlanScreen } from "@/components/trade/delivery-plan-form";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><EditDeliveryPlanScreen id={id} /></Suspense>;
}
