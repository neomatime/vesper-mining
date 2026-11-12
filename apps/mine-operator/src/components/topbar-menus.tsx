"use client";

import { Bell, Check, ChevronDown, HardHat, LogOut, Monitor, Settings2, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { entitlementsFor } from "@/lib/entitlements";
import { canManageOrganisation } from "@/lib/organisation-rules";
import { initials, tierLabel, tiers } from "@/lib/personas";
import { useDemoContext } from "@/stores/demo-context";
import { useSession } from "@/stores/session";
import { NotificationList, useNotifications } from "./notification-list";
import { useDismiss } from "./use-dismiss";

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
  const tier = tiers.find((item) => item.value === context.tier);

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
            {tier ? `${tierLabel(context.tier)} includes ${tier.sites.toLowerCase()}. ` : ""}
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
              <Link href="/mobile/notifications" onClick={close}>View all</Link>
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

export function ProfileMenu({ inField }: { inField: boolean }) {
  const { open, setOpen, close, ref } = useMenu();
  const router = useRouter();
  const { context } = useDemoContext();
  const signOut = useSession((state) => state.signOut);
  const mobileIncluded = entitlementsFor(context.tier).mobile;
  const canAdminister = canManageOrganisation({ name: context.persona, role: context.role }).allowed;

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
        onClick={() => setOpen((value) => !value)}
      >
        <span className="avatar">{initials(context.persona)}</span>
        <span><strong>{context.persona}</strong><small>{context.role}</small></span>
        <ChevronDown size={14} aria-hidden="true" className={open ? "chevron--open" : ""} />
      </button>
      {open ? (
        <div className="popover popover--menu" role="group" aria-label="Account menu">
          <div className="profile-card">
            <span className="avatar avatar--medium">{initials(context.persona)}</span>
            <div>
              <strong>{context.persona}</strong>
              <small>{context.role} · {context.siteName}</small>
            </div>
          </div>

          <div className="menu-section">
            {inField ? (
              <Link className="menu-item" href="/overview" onClick={close}>
                <span className="menu-item__icon"><Monitor size={16} /></span>
                <span className="menu-item__copy"><strong>Back to desktop view</strong><small>Command Centre</small></span>
              </Link>
            ) : mobileIncluded ? (
              <Link className="menu-item" href="/mobile/my-shift" onClick={close}>
                <span className="menu-item__icon"><Smartphone size={16} /></span>
                <span className="menu-item__copy"><strong>Open field experience</strong><small>Phone layout for field teams</small></span>
              </Link>
            ) : (
              <div className="menu-item menu-item--off" aria-disabled="true">
                <span className="menu-item__icon"><Smartphone size={16} /></span>
                <span className="menu-item__copy"><strong>Field experience</strong><small>Not included in {tierLabel(context.tier)}</small></span>
              </div>
            )}
            {canAdminister ? (
              <Link className="menu-item" href="/admin" onClick={close}>
                <span className="menu-item__icon"><Settings2 size={16} /></span>
                <span className="menu-item__copy"><strong>Administration</strong><small>People, rights, site and plan</small></span>
              </Link>
            ) : null}
          </div>

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
