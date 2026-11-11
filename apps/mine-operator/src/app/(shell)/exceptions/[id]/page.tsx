import { IssueDetailScreen } from "@/components/issue-detail-screen";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IssueDetailScreen id={id} />;
}
