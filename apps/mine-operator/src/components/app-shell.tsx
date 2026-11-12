"use client";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  CirclePlus,
  ClipboardCheck,
  Gauge,
  HardHat,
  Layers3,
  LayoutDashboard,
  Map,
  Menu,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { entitlementsFor } from "@/lib/entitlements";
import { useDemoContext } from "@/stores/demo-context";
import { CommandSearch } from "./command-search";
import { EntitlementGate } from "./entitlement-gate";
import { useShellData } from "./shell-data";
import { NotificationMenu, ProfileMenu, SiteMenu } from "./topbar-menus";

type CountKey = "openIssues" | "awaitingDependency" | "readinessAttention";

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  count?: CountKey;
};

const primaryNavigation: NavigationItem[] = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Operational Map", href: "/map", icon: Map },
  { label: "Work & Exceptions", href: "/exceptions", icon: AlertTriangle, count: "openIssues" },
  { label: "Equipment & Maintenance", href: "/equipment", icon: Wrench },
  { label: "Resource Readiness", href: "/resources", icon: PackageCheck, count: "readinessAttention" },
  { label: "Shift Control", href: "/shifts", icon: UsersRound },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Administration", href: "/admin", icon: Settings2 },
];

const contextualNavigation: { label: string; items: NavigationItem[] }[] = [
  {
    label: "Workflow",
    items: [
      { label: "Report an issue", href: "/exceptions/new", icon: CirclePlus },
      { label: "Awaiting dependency", href: "/exceptions?filter=waiting", icon: ClipboardCheck, count: "awaitingDependency" },
      { label: "Readiness risks", href: "/resources?filter=attention", icon: Boxes, count: "readinessAttention" },
      { label: "Shift handover", href: "/shifts", icon: ShieldCheck },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Performance", href: "/reports/production-vs-plan", icon: Gauge },
      { label: "Delay stages", href: "/reports/equipment-delay-stages", icon: Layers3 },
    ],
  },
];

const mobileNavigation: NavigationItem[] = [
  { label: "My Shift", href: "/mobile/my-shift", icon: HardHat },
  { label: "My Work", href: "/mobile/my-work", icon: ClipboardCheck },
  { label: "Report", href: "/mobile/report", icon: AlertTriangle },
  { label: "Notifications", href: "/mobile/notifications", icon: Bell },
];

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { context, sidebarCollapsed, toggleSidebar } = useDemoContext();
  const { counts, data: shellData } = useShellData();
  const currentShift = shellData?.shifts.find((item) => item.state === "in_progress") ?? shellData?.shifts.find((item) => item.state === "scheduled");
  const isMobileExperience = pathname.startsWith("/mobile/");
  const mobileLocked = isMobileExperience && !entitlementsFor(context.tier).mobile;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !isTypingTarget(event.target) && !event.metaKey && !event.ctrlKey;
      if (commandK || slash) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const active = (href: string) => {
    if (href.includes("?")) return false;
    return pathname === href || (href !== "/overview" && pathname.startsWith(`${href}/`));
  };

  const countFor = (item: NavigationItem) => (item.count ? counts[item.count] : 0);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "app-shell--collapsed" : ""}`}>
      <header className="topbar">
        <div className="brand-block">
          <button
            className="icon-button topbar__menu"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
          <Link href="/overview" className="wordmark" aria-label="VESPER overview">
            VESPER
          </Link>
        </div>

        <SiteMenu />

        <nav className="topbar__shortcuts" aria-label="Workspace shortcuts">
          <Link aria-current={pathname === "/overview" ? "page" : undefined} className={pathname === "/overview" ? "active" : ""} href="/overview">Overview</Link>
          <Link aria-current={pathname.startsWith("/exceptions") ? "page" : undefined} className={pathname.startsWith("/exceptions") ? "active" : ""} href="/exceptions">Operations</Link>
          <Link aria-current={pathname.startsWith("/resources") ? "page" : undefined} className={pathname.startsWith("/resources") ? "active" : ""} href="/resources">Readiness</Link>
          <Link aria-current={pathname.startsWith("/reports") ? "page" : undefined} className={pathname.startsWith("/reports") ? "active" : ""} href="/reports">Reports</Link>
        </nav>

        <div className="topbar__actions">
          <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search records and workspaces" aria-keyshortcuts="Control+K Meta+K">
            <Search aria-hidden="true" />
            <span>Search</span>
            <kbd>Ctrl K</kbd>
          </button>
          <NotificationMenu />
          <ProfileMenu inField={isMobileExperience} />
        </div>
      </header>

      {!isMobileExperience ? (
        <aside
          className={`sidebar ${mobileOpen ? "sidebar--mobile-open" : ""}`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setMobileOpen(false);
          }}
        >
          <div className="sidebar__site-card">
            <div className="mine-thumbnail" aria-hidden="true"><span /></div>
            {!sidebarCollapsed ? <div><strong>{context.siteName}</strong><small>Open pit</small></div> : null}
          </div>
          <nav className="sidebar__nav" aria-label="Primary workspaces">
            {primaryNavigation.map((item) => {
              const count = countFor(item);
              return (
                <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""} aria-current={active(item.href) ? "page" : undefined} title={item.label}>
                  <item.icon aria-hidden="true" />
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                  {!sidebarCollapsed && count ? <em aria-label={`${count} need attention`}>{count}</em> : null}
                </Link>
              );
            })}
          </nav>
          {!sidebarCollapsed ? contextualNavigation.map((group) => (
            <div className="sidebar__group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((rawItem) => {
                const item = rawItem.label === "Shift handover" && currentShift ? { ...rawItem, href: `/shifts/${currentShift.id}/handover` } : rawItem;
                const count = countFor(item);
                return (
                  <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""}>
                    <item.icon aria-hidden="true" />
                    <span>{item.label}</span>
                    {count ? <em aria-label={`${count} open`}>{count}</em> : null}
                  </Link>
                );
              })}
            </div>
          )) : null}
          <button className="sidebar__collapse" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {!sidebarCollapsed ? <span>Collapse navigation</span> : null}
          </button>
        </aside>
      ) : null}

      <main className={`main-content ${isMobileExperience ? "main-content--mobile" : ""}`}>
        {mobileLocked ? <EntitlementGate capability="mobile" /> : children}
      </main>

      {isMobileExperience && !mobileLocked ? (
        <nav className="mobile-bottom-nav" aria-label="Field navigation">
          {mobileNavigation.map((item) => (
            <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""} aria-current={active(item.href) ? "page" : undefined}>
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
