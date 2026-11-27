/**
 * Route page. Renders the report-an-issue form.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { Suspense } from "react";
import { IssueReportForm } from "@core/components/issue-report-form";

export const metadata: Metadata = { title: "Report Issue" };

export default function NewIssuePage() {
  return (
    <Suspense fallback={null}>
      <IssueReportForm />
    </Suspense>
  );
}
