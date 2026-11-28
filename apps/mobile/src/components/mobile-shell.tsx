"use client";

/**
 * The frame around every signed-in page of VESPER Mobile: a slim top bar (site, notifications, account), the page, and the four
 * bottom tabs (My Shift, My Work, Report, Notifications). While offline a banner says so, and what was recorded waits in the
 * outbox; it is sent automatically on reconnecting. When the subscription does not include VESPER Mobile, the page says so
 * instead of showing field work.
 */
import { AlertTriangle, Bell, ClipboardCheck, CloudOff, HardHat } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { EntitlementGate } from "@core/components/entitlement-gate";
import { RouteProgress } from "@core/components/route-progress";
import { NotificationMenu, ProfileMenu, SiteMenu } from "@core/components/topbar-menus";
import { useOutboxSync } from "@core/components/use-outbox-sync";
import { useOutbox } from "@core/stores/outbox";
import { entitlementsFor } from "@core/lib/entitlements";
import { useDemoContext } from "@core/stores/demo-context";

const tabs = [
  { label: "My Shift", href: "/my-shift", icon: HardHat, also: ["/schedule", "/shifts", "/checks", "/scan", "/machines"] },
  { label: "My Work", href: "/my-work", icon: ClipboardCheck, also: [] },
  { label: "Report", href: "/report", icon: AlertTriangle, also: ["/my-reports", "/issues"] },
  { label: "Notifications", href: "/notifications", icon: Bell, also: [] },
];

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { context, connectivity, setConnectivity } = useDemoContext();
  const included = entitlementsFor(context.tier).mobile;
  const waiting = useOutbox((state) => state.items.filter((item) => item.by === context.persona).length);
  useOutboxSync();

  // Follow the phone's real signal: losing it switches to offline (what is recorded waits in the outbox); getting it back sends.
  useEffect(() => {
    const lost = () => setConnectivity("offline");
    const back = () => setConnectivity("online");
    window.addEventListener("offline", lost);
    window.addEventListener("online", back);
    if (!navigator.onLine) lost();
    return () => {
      window.removeEventListener("offline", lost);
      window.removeEventListener("online", back);
    };
  }, [setConnectivity]);
  const active = (tab: (typeof tabs)[number]) => [tab.href, ...tab.also].some((path) => pathname === path || pathname.startsWith(`${path}/`));

  return (
    <div className="app-shell app-shell--field">
      <header className="topbar">
        <div className="brand-block">
          <Link href="/my-shift" className="wordmark" aria-label="VESPER Mobile, My Shift">VESPER</Link>
        </div>
        <SiteMenu />
        <div className="topbar__actions">
          <NotificationMenu />
          <ProfileMenu />
        </div>
      </header>

      <RouteProgress />
      {connectivity === "offline" ? (
        <div className="offline-banner" role="status">
          <CloudOff aria-hidden="true" />
          <span><strong>Offline</strong>{waiting ? ` · ${waiting} waiting to send` : " · what you record is kept on this phone"}</span>
          <button type="button" onClick={() => setConnectivity("online")}>Back online</button>
        </div>
      ) : null}
      <main className={`main-content main-content--mobile ${connectivity === "offline" ? "main-content--offline" : ""}`}>{included ? children : <EntitlementGate capability="mobile" />}</main>

      {included ? (
        <nav className="mobile-bottom-nav" aria-label="Field navigation">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className={active(tab) ? "active" : ""} aria-current={active(tab) ? "page" : undefined}>
              <tab.icon aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
