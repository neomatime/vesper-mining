/**
 * Route page. The Logistics tab was removed from Shipments: each shipment's page shows its collection request, and transport
 * providers, agreements and requests are managed in Trade's Logistics. Old links land on the shipment list.
 */
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/shipments/list");
}
