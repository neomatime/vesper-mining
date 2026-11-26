/**
 * Route page. Sends the address to /trade/overview.
 */
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/trade/overview");
}
