import type { Metadata } from "next";
import { Suspense } from "react";
import { IssueReportForm } from "@/components/issue-report-form";

export const metadata: Metadata = { title: "Report Issue" };

export default function NewIssuePage() {
  return (
    <Suspense fallback={null}>
      <IssueReportForm />
    </Suspense>
  );
}
