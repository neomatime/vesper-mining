/**
 * Route page. Renders the phone's report-an-issue form.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { Suspense } from "react";
import { IssueReportForm } from "@core/components/issue-report-form";

export default function MobileReportPage() {
  return (
    <Suspense fallback={null}>
      <IssueReportForm mobile />
    </Suspense>
  );
}
