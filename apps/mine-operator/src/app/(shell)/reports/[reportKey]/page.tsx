import { ReportDetailScreen } from "@/components/report-detail-screen";

export default async function ReportPage({ params }: { params: Promise<{ reportKey: string }> }) {
  const { reportKey } = await params;
  return <ReportDetailScreen reportKey={reportKey} />;
}
