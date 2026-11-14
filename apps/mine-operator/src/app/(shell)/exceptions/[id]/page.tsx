/**
 * Route page. Renders one issue: lifecycle, actions, dependencies and history.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { IssueDetailScreen } from "@/components/issue-detail-screen";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IssueDetailScreen id={id} />;
}
