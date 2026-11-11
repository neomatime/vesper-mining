"use client";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  FileText,
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
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { demoFetch } from "@/lib/api";
import { useDemoContext } from "@/stores/demo-context";

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  count?: number;
};

const primaryNavigation: NavigationItem[] = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Operational Map", href: "/map", icon: Map },
  { label: "Work & Exceptions", href: "/exceptions", icon: AlertTriangle, count: 2 },
  { label: "Equipment & Maintenance", href: "/equipment", icon: Wrench },
  { label: "Resource Readiness", href: "/resources", icon: PackageCheck },
  { label: "Shift Control", href: "/shifts", icon: UsersRound },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Administration", href: "/admin", icon: Settings2 },
];

const contextualNavigation: { label: string; items: NavigationItem[] }[] = [
  {
    label: "Workflow",
    items: [
      { label: "Actions", href: "/exceptions?view=actions", icon: ClipboardCheck, count: 4 },
      { label: "Work-order references", href: "/equipment?view=work-orders", icon: FileText },
      { label: "Readiness reviews", href: "/resources?view=reviews", icon: Boxes },
      { label: "Shift Handover", href: "/shifts/shift-a-20250424/handover", icon: ShieldCheck },
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

type DemoNotification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  unread: boolean;
  category: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const { context, sidebarCollapsed, toggleSidebar } = useDemoContext();
  const isMobileExperience = pathname.startsWith("/mobile/");
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", context.siteId],
    queryFn: () => demoFetch<DemoNotification[]>("/notifications"),
  });
  const unreadCount = notifications.filter((item) => item.unread).length;

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  const active = (href: string) => {
    const base = href.split("?")[0];
    return pathname === base || (base !== "/overview" && pathname.startsWith(`${base}/`));
  };

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
            VESPER <span>v3.0</span>
          </Link>
        </div>

        <button className="site-selector" aria-label="Selected demonstration site">
          <span className="site-selector__icon"><HardHat size={17} /></span>
          <span>{context.siteName}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>

        <nav className="topbar__shortcuts" aria-label="Workspace shortcuts">
          <Link className={pathname === "/overview" ? "active" : ""} href="/overview">Overview</Link>
          <Link className={pathname.startsWith("/exceptions") ? "active" : ""} href="/exceptions">Operations</Link>
          <Link className={pathname.startsWith("/resources") ? "active" : ""} href="/resources">Readiness</Link>
          <Link className={pathname.startsWith("/reports") ? "active" : ""} href="/reports">Reports</Link>
        </nav>

        <div className="topbar__actions">
          <div className="demo-pill" title="All sites, users, events and actions are fictional">
            <span aria-hidden="true" /> DEMO / SIMULATED DATA
          </div>
          <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Search fictional records">
            <Search />
          </button>
          <div className="popover-anchor">
            <button
              className="icon-button"
              onClick={() => setNotificationsOpen((value) => !value)}
              aria-label={`${unreadCount} unread demo notifications`}
              aria-expanded={notificationsOpen}
            >
              <Bell />
              {unreadCount ? <span className="notification-dot">{unreadCount}</span> : null}
            </button>
            {notificationsOpen ? (
              <div className="popover notification-popover">
                <div className="popover__header">
                  <div><span className="eyebrow">Demo alerts</span><h2>Notifications</h2></div>
                  <Link href="/mobile/notifications">View all</Link>
                </div>
                {notifications.map((item) => (
                  <Link key={item.id} href={item.href} onClick={() => setNotificationsOpen(false)} className={`notification-item ${item.unread ? "notification-item--unread" : ""}`}>
                    <span className="notification-item__icon"><Bell size={15} /></span>
                    <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <Link className="profile-chip" href="/mobile/profile">
            <span className="avatar">JD</span>
            <span><strong>{context.persona}</strong><small>{context.role}</small></span>
          </Link>
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
            {!sidebarCollapsed ? <div><strong>Riverside Mine</strong><small>Open Pit · Fictional</small></div> : null}
          </div>
          <nav className="sidebar__nav" aria-label="Primary workspaces">
            {primaryNavigation.map((item) => (
              <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""} title={item.label}>
                <item.icon aria-hidden="true" />
                {!sidebarCollapsed ? <span>{item.label}</span> : null}
                {!sidebarCollapsed && item.count ? <em>{item.count}</em> : null}
              </Link>
            ))}
          </nav>
          {!sidebarCollapsed ? contextualNavigation.map((group) => (
            <div className="sidebar__group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""}>
                  <item.icon aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.count ? <em>{item.count}</em> : null}
                </Link>
              ))}
            </div>
          )) : null}
          <button className="sidebar__collapse" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {!sidebarCollapsed ? <span>Collapse navigation</span> : null}
          </button>
        </aside>
      ) : null}

      <main className={`main-content ${isMobileExperience ? "main-content--mobile" : ""}`}>
        {children}
      </main>

      {isMobileExperience ? (
        <nav className="mobile-bottom-nav" aria-label="Field navigation">
          {mobileNavigation.map((item) => (
            <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""}>
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {searchOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
          <section className="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="search-dialog__input">
              <Search aria-hidden="true" />
              <label className="sr-only" htmlFor="global-search">Search fictional records</label>
              <input ref={searchInput} id="global-search" placeholder="Try C-02, EX-204 or RIV-2025-041" />
              <button className="icon-button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X /></button>
            </div>
            <div className="search-results">
              <p>Suggested fictional records</p>
              <button onClick={() => { setSearchOpen(false); router.push("/exceptions/issue-riv-001"); }}><AlertTriangle /> Crusher C-02 — Feed Interruption <span>Issue</span></button>
              <button onClick={() => { setSearchOpen(false); router.push("/equipment/eq-ex204"); }}><Wrench /> Hydraulic Excavator EX-204 <span>Equipment</span></button>
              <button onClick={() => { setSearchOpen(false); router.push("/map"); }}><Map /> North Pit <span>Operating area</span></button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
