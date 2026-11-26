/**
 * Route page. Sends the address to /trade/logistics?tab=requests.
 */
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/trade/logistics?tab=requests");
}
