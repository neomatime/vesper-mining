/**
 * Route page. Renders the Record production form. ?id= continues a draft or corrects a record that was sent back.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { Suspense } from "react";
import { RecordProductionRoute } from "@/components/production-screens";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecordProductionRoute />
    </Suspense>
  );
}
