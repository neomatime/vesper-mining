import { Suspense } from "react";
import { IssueReportForm } from "@/components/issue-report-form";

export default function MobileReportPage() {
  return (
    <Suspense fallback={null}>
      <IssueReportForm mobile />
    </Suspense>
  );
}
