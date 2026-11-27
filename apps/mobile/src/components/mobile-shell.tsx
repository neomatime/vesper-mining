"use client";

/**
 * The frame around every signed-in page of VESPER Mobile: a slim top bar (site, notifications, account), the page, and the four
 * bottom tabs (My Shift, My Work, Report, Notifications). When the subscription does not include VESPER Mobile, the page says
 * so instead of showing field work.
 */
import { AlertTriangle, Bell, ClipboardCheck, HardHat } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EntitlementGate } from "@core/components/entitlement-gate";
import { RouteProgress } from "@core/components/route-progress";
import { NotificationMenu, ProfileMenu, SiteMenu } from "@core/components/topbar-menus";
import { entitlementsFor } from "@core/lib/entitlements";
import { useDemoContext } from "@core/stores/demo-context";

const tabs = [
  { label: "My Shift", href: "/my-shift", icon: HardHat, also: ["/schedule", "/shifts"] },
  { label: "My Work", href: "/my-work", icon: ClipboardCheck, also: ["/issues"] },
  { label: "Report", href: "/report", icon: AlertTriangle, also: [] },
  { label: "Notifications", href: "/notifications", icon: Bell, also: [] },
];

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { context } = useDemoContext();
  const included = entitlementsFor(context.tier).mobile;
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
      <main className="main-content main-content--mobile">{included ? children : <EntitlementGate capability="mobile" />}</main>

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
