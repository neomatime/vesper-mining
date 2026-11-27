"use client";

/**
 * The frame around every signed-in page: the top bar (menu button, command search, site, notifications, profile), the collapsible
 * sidebar and the page area. Field work happens in VESPER Mobile, a separate app (apps/mobile).
 * Navigation is data (the arrays near the top). Each item can name a subscription `feature`; items whose feature the subscription
 * does not include are filtered out, so a plan change changes the menu without touching this file's markup.
 */
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CirclePlus,
  ClipboardCheck,
  Database,
  FileText,
  Files,
  Layers,
  LayoutDashboard,
  Link2,
  Mail,
  Map,
  Menu,
  Network,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Truck,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RouteProgress } from "@core/components/route-progress";
import { ScrollHints } from "@core/components/scroll-hints";
import { useEffect, useState } from "react";
import type { FeatureCode } from "@vesper/api-contracts";
import { can } from "@core/lib/entitlements";
import { useDemoContext } from "@core/stores/demo-context";
import { CommandSearch } from "./command-search";
import { useShellData } from "@core/components/shell-data";
import { NotificationMenu, ProfileMenu, SiteMenu } from "@core/components/topbar-menus";
import { workspaceOf, workspaces } from "@core/lib/workspaces";

type CountKey = "openIssues" | "awaitingDependency" | "readinessAttention";

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  count?: CountKey;
  /** The feature a subscription must include for this item to show. */
  feature?: FeatureCode;
};

/**
 * The sidebar, in groups: Overview, Operations, Workflow shortcuts and Intelligence. `feature` hides an item the subscription does not
 * include; `count` shows a live number. The Workflow shortcuts are secondary: they are left out of the narrow, icon-only sidebar.
 */
const navigationSections: { label: string; secondary?: boolean; items: NavigationItem[] }[] = [
  {
    label: "Overview",
    items: [
      { label: "Overview", href: "/overview", icon: LayoutDashboard },
      { label: "Operational Map", href: "/map", icon: Map },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Work & Exceptions", href: "/exceptions", icon: AlertTriangle, count: "openIssues" },
      { label: "Equipment & Maintenance", href: "/equipment", icon: Wrench },
      { label: "Resource Readiness", href: "/resources", icon: PackageCheck, count: "readinessAttention", feature: "resource_readiness" },
      { label: "Shift Control", href: "/shifts", icon: UsersRound },
      { label: "Shipments", href: "/shipments", icon: Truck },
    ],
  },
  {
    label: "Workflow",
    secondary: true,
    items: [
      { label: "Awaiting dependency", href: "/exceptions?filter=waiting", icon: ClipboardCheck, count: "awaitingDependency" },
      { label: "Readiness risks", href: "/resources?filter=attention", icon: Boxes, count: "readinessAttention", feature: "resource_readiness" },
    ],
  },
  {
    // Every measure is inside Reports, so it is the one entry here.
    label: "Intelligence",
    items: [{ label: "Reports", href: "/reports", icon: BarChart3 }],
  },
];

/** The Trade workspace's sidebar: the commercial side of the same mine. */
const tradeSections: { label: string; secondary?: boolean; items: NavigationItem[] }[] = [
  {
    label: "Overview",
    items: [
      { label: "Overview", href: "/trade/overview", icon: LayoutDashboard },
      { label: "Portfolio", href: "/trade/portfolio", icon: Layers },
    ],
  },
  {
    label: "Commercial Operations",
    items: [
      { label: "Enquiries", href: "/trade/enquiries", icon: Mail },
      { label: "Agreements", href: "/trade/agreements", icon: FileText },
      { label: "Deliveries", href: "/trade/deliveries", icon: Truck },
      { label: "Logistics", href: "/trade/logistics", icon: Network },
      { label: "Settlements", href: "/trade/settlements", icon: Database },
    ],
  },
  {
    label: "Workflow",
    items: [
      { label: "Approvals", href: "/trade/approvals", icon: ClipboardCheck },
      { label: "Documents", href: "/trade/documents", icon: Files },
      { label: "Linked Operations", href: "/trade/linked-operations", icon: Link2 },
    ],
  },
  {
    label: "Intelligence",
    items: [{ label: "Reports", href: "/trade/reports", icon: BarChart3 }],
  },
];

/** True while the person is typing in a field, so a keyboard shortcut such as '/' does not steal the keystroke. */
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
  const { counts } = useShellData();
  const workspace = workspaceOf(pathname);
  const sections = workspace === "trade" ? tradeSections : navigationSections;
  const home = workspaces[workspace].home;

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

  // A sidebar item is active on its own page and on pages beneath it. Items with a query string (filters) are never marked active.
  const active = (href: string) => {
    if (href.includes("?")) return false;
    return pathname === href || (href !== home && pathname.startsWith(`${href}/`));
  };

  const included = (item: NavigationItem) => !item.feature || can(context.tier, item.feature);
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
          <Link href={home} className="wordmark" aria-label={`VESPER ${workspaces[workspace].label} overview`}>
            VESPER
          </Link>
        </div>

        <SiteMenu />

        <div className="topbar__actions">
          <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search records and workspaces" aria-keyshortcuts="Control+K Meta+K">
            <Search aria-hidden="true" />
            <span>Search</span>
            <kbd>Ctrl K</kbd>
          </button>
          <Link className="topbar__report" href="/exceptions/new" aria-label="Report an issue">
            <CirclePlus aria-hidden="true" />
            <span>Report issue</span>
          </Link>
          <NotificationMenu />
          <ProfileMenu />
        </div>
      </header>

      <aside
        className={`sidebar ${mobileOpen ? "sidebar--mobile-open" : ""}`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setMobileOpen(false);
        }}
      >
        <div className="sidebar__site-card">
          <div className="mine-thumbnail" aria-hidden="true"><span /></div>
          {!sidebarCollapsed ? (workspace === "trade" ? <div><strong>VESPER Trade</strong><small>{context.siteName}</small></div> : <div><strong>{context.siteName}</strong><small>Open pit</small></div>) : null}
        </div>
        <nav className="sidebar__nav" aria-label={workspace === "trade" ? "Trade navigation" : "Primary workspaces"}>
          {sections.filter((section) => !(sidebarCollapsed && section.secondary)).map((section) => (
            <div className={`sidebar__section ${section.secondary ? "sidebar__section--secondary" : ""}`} key={section.label}>
              {!sidebarCollapsed ? <p className="sidebar__heading">{section.label}</p> : null}
              {section.items.filter(included).map((item) => {
                const count = countFor(item);
                return (
                  <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""} aria-current={active(item.href) ? "page" : undefined} title={item.label}>
                    <item.icon aria-hidden="true" />
                    {!sidebarCollapsed ? <span>{item.label}</span> : null}
                    {!sidebarCollapsed && count ? <em aria-label={`${count} ${section.secondary ? "open" : "need attention"}`}>{count}</em> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <button className="sidebar__collapse" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!sidebarCollapsed ? <span>Collapse navigation</span> : null}
        </button>
      </aside>

      <RouteProgress />
      <ScrollHints />
      <main className="main-content">{children}</main>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
