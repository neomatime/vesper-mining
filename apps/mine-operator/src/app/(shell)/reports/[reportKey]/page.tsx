/**
 * Route page. Renders one report.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { ReportDetailScreen } from "@/components/report-detail-screen";

export default async function ReportPage({ params }: { params: Promise<{ reportKey: string }> }) {
  const { reportKey } = await params;
  return <ReportDetailScreen reportKey={reportKey} />;
}
