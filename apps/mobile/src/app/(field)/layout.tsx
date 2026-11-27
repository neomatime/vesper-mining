/**
 * The layout for every signed-in page of VESPER Mobile: RequireSession sends visitors without a session to sign-in, and
 * MobileShell draws the header, the page and the bottom tabs.
 */
import { RequireSession } from "@core/components/require-session";
import { MobileShell } from "@/components/mobile-shell";

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession>
      <MobileShell>{children}</MobileShell>
    </RequireSession>
  );
}
