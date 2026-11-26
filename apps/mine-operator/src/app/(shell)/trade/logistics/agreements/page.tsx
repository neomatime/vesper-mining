/**
 * Route page. Sends the address to /trade/logistics?tab=agreements.
 */
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/trade/logistics?tab=agreements");
}
