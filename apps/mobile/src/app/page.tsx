/**
 * The app's front door: VESPER Mobile opens on My Shift (signing in first when needed).
 */
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/my-shift");
}
