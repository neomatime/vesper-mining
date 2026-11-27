/**
 * The layout for every signed-in page: RequireSession sends visitors without a session to sign-in, and AppShell draws the top
 * bar, navigation and page frame around the screen.
 */
import { AppShell } from "@/components/app-shell";
import { RequireSession } from "@core/components/require-session";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession>
      <AppShell>{children}</AppShell>
    </RequireSession>
  );
}
