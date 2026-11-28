"use client";

/**
 * The three menus in the top bar: site, notifications and profile.
 */
import { Bell, Check, ChevronDown, ChevronRight, Download, HardHat, LogOut, Pickaxe, Settings2, Network } from "lucide-react";
// Links follow the app showing the menu (Mining Operations or VESPER Mobile); see app-context.tsx.
import { AppLink as Link, useApp } from "./app-context";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { entitlementsFor } from "../lib/entitlements";
import { canManageOrganisation } from "../lib/organisation-rules";
import { initials } from "../lib/personas";
import { workspaceOf, workspacesFor } from "../lib/workspaces";
import { useDemoContext } from "../stores/demo-context";
import { useSession } from "../stores/session";
import { NotificationList, useNotifications } from "./notification-list";
import { useDismiss } from "./use-dismiss";
import { ThemeSwitch } from "./theme-switch";
import { useInstallApp } from "./use-install-app";

function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  return { open, setOpen, close, ref };
}

export function SiteMenu() {
  const { open, setOpen, close, ref } = useMenu();
  const { context } = useDemoContext();
  const plan = entitlementsFor(context.tier);

  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className="site-selector"
        data-menu-trigger
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="site-selector__icon"><HardHat size={17} /></span>
        <span className="site-selector__copy">
          <small>Site</small>
          <strong>{context.siteName}</strong>
        </span>
        <ChevronDown size={15} aria-hidden="true" className={open ? "chevron--open" : ""} />
      </button>
      {open ? (
        <div className="popover popover--menu popover--left" role="group" aria-label="Switch site">
          <div className="popover__header">
            <div><h2>Your sites</h2></div>
          </div>
          <div className="menu-section">
            <button className="menu-item menu-item--selected" onClick={close} aria-pressed="true">
              <span className="menu-item__icon"><HardHat size={16} /></span>
              <span className="menu-item__copy"><strong>{context.siteName}</strong><small>Open pit</small></span>
              <Check size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="menu-note">
            {`${plan.label} includes ${plan.sites.toLowerCase()}. `}
            Your other sites will appear here once they are added.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationMenu() {
  const { open, setOpen, close, ref } = useMenu();
  const notifications = useNotifications();

  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className="icon-button"
        data-menu-trigger
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications, ${notifications.unread} unread`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell />
        {notifications.unread ? <span className="notification-dot">{notifications.unread}</span> : null}
      </button>
      {open ? (
        <div className="popover notification-popover">
          <div className="popover__header">
            <div><h2>Notifications</h2></div>
            <div className="popover__header-actions">
              {notifications.unread ? (
                <button className="link-button" onClick={notifications.readAll} disabled={notifications.readAllPending}>Mark all read</button>
              ) : null}
              <Link href="/notifications" onClick={close}>View all</Link>
            </div>
          </div>
          <NotificationList
            items={notifications.items}
            onToggleRead={notifications.toggleRead}
            onDismiss={notifications.dismiss}
            onOpen={(item) => {
              notifications.markRead(item);
              close();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** The account menu: profile, workspaces and administration on the web; VESPER Mobile keeps to the field app. Each app is opened at its own address, not from here. */
export function ProfileMenu() {
  const { open, setOpen, close, ref } = useMenu();
  const inField = useApp() === "mobile";
  const router = useRouter();
  const { context } = useDemoContext();
  const signOut = useSession((state) => state.signOut);
  const pathname = usePathname();
  const current = workspaceOf(pathname);
  // Only the workspaces this role may open. Switching keeps the session, the site and the role; it only opens that workspace's Overview.
  const available = inField ? [] : workspacesFor(context.role);
  const canAdminister = canManageOrganisation({ name: context.persona, role: context.role }).allowed;
  // Only true where the browser can install web apps and VESPER is not already installed.
  const { canInstall, install } = useInstallApp();

  const handleSignOut = () => {
    close();
    signOut();
    router.replace("/sign-in");
  };

  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className="profile-chip"
        data-menu-trigger
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account menu for ${context.persona}`}
        onClick={() => {
          // Opening the menu warms up the other workspace, so switching feels immediate.
          if (!open) for (const item of available) router.prefetch(item.home);
          setOpen((value) => !value);
        }}
      >
        <span className="avatar">{initials(context.persona)}</span>
        <span><strong>{context.persona}</strong><small>{context.role}</small></span>
        <ChevronDown size={14} aria-hidden="true" className={open ? "chevron--open" : ""} />
      </button>
      {open ? (
        <div className="popover popover--menu" role="group" aria-label="Account menu">
          <Link className="profile-card profile-card--link" href="/profile" onClick={close} aria-label={`Open the profile for ${context.persona}`}>
            <span className="avatar avatar--medium">{initials(context.persona)}</span>
            <div>
              <strong>{context.persona}</strong>
              <small>{context.role} · {context.siteName}</small>
            </div>
            <ChevronRight size={16} aria-hidden="true" className="profile-card__chevron" />
          </Link>

          {available.length > 1 ? (
            <div className="menu-section" role="group" aria-labelledby="switch-workspace-heading">
              <p className="menu-section__heading" id="switch-workspace-heading">Switch workspace</p>
              {available.map((item) => {
                const active = item.key === current;
                const Icon = item.key === "trade" ? Network : Pickaxe;
                return (
                  <button
                    key={item.key}
                    className={`menu-item ${active ? "menu-item--current" : ""}`}
                    aria-current={active ? "true" : undefined}
                    onClick={() => {
                      close();
                      if (!active) router.push(item.home);
                    }}
                  >
                    <span className="menu-item__icon"><Icon size={16} /></span>
                    <span className="menu-item__copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                    {active ? <Check size={16} className="menu-item__check" aria-label="Current workspace" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Administration is on the web only; VESPER Mobile keeps to field work. */}
          {canAdminister && !inField ? (
            <div className="menu-section">
              <Link className="menu-item" href="/admin" onClick={close}>
                <span className="menu-item__icon"><Settings2 size={16} /></span>
                <span className="menu-item__copy"><strong>Administration</strong><small>People, rights, site and plan</small></span>
              </Link>
            </div>
          ) : null}

          <div className="menu-section">
            <ThemeSwitch />
          </div>

          {canInstall ? (
            <div className="menu-section">
              <button className="menu-item" onClick={() => { close(); void install(); }}>
                <span className="menu-item__icon"><Download size={16} /></span>
                <span className="menu-item__copy"><strong>Install app</strong><small>Open VESPER in its own window</small></span>
              </button>
            </div>
          ) : null}

          <div className="menu-section menu-section--footer">
            <button className="menu-item" onClick={handleSignOut}>
              <span className="menu-item__icon"><LogOut size={16} /></span>
              <span className="menu-item__copy"><strong>Sign out</strong><small>End your session on this device</small></span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
