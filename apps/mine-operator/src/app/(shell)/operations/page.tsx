/**
 * Route page. /operations is accepted as the Mining Operations workspace; its pages keep their established addresses.
 */
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/overview");
}
