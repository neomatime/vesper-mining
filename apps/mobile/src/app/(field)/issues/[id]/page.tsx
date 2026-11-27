/**
 * Route page. An issue as the field sees it: what it is, where, its state and the actions on it.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { MobileIssueScreen } from "@/components/mobile-issue-screen";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MobileIssueScreen id={id} />;
}
