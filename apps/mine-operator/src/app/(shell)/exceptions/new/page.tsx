import type { Metadata } from "next";
import { IssueReportForm } from "@/components/issue-report-form";

export const metadata: Metadata = { title: "Report Issue" };
export default function NewIssuePage() { return <IssueReportForm />; }
