"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  ChevronDown,
  HardHat,
  Monitor,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Layers3,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { demoFetch } from "@/lib/api";
import { entitlementsFor } from "@/lib/entitlements";
import { initials, personas, tierLabel, tiers, type Persona } from "@/lib/personas";
import { useDemoContext } from "@/stores/demo-context";
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
            <div><span className="eyebrow">Your sites</span><h2>Select a site</h2></div>
          </div>
          <div className="menu-section">
            <button className="menu-item menu-item--selected" onClick={close} aria-pressed="true">
              <span className="menu-item__icon"><HardHat size={16} /></span>
              <span className="menu-item__copy"><strong>{context.siteName}</strong><small>Open pit · Fictional</small></span>
              <Check size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="menu-note">
            {tier ? `${tierLabel(context.tier)} includes ${tier.sites.toLowerCase()}. ` : ""}
            Additional sites are not provisioned in this demonstration.
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
            <div><span className="eyebrow">Simulated alerts</span><h2>Notifications</h2></div>
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
  const [confirmReset, setConfirmReset] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { context, setContext, resetControls } = useDemoContext();
  const reset = useMutation({
    mutationFn: () => demoFetch<unknown>("/scenario/reset", { method: "POST" }),
    onSuccess: async () => {
      resetControls();
      await queryClient.invalidateQueries();
      setConfirmReset(false);
      close();
    },
  });

  const toggle = () => {
    setOpen((value) => !value);
    setConfirmReset(false);
  };

  const switchPersona = (persona: Persona) => {
    setContext({ persona: persona.name, role: persona.role });
    if (persona.fieldOnly && !inField) router.push("/mobile/my-shift");
    if (!persona.fieldOnly && inField) router.push("/overview");
    close();
  };

  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className="profile-chip"
        data-menu-trigger
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account menu for ${context.persona}`}
        onClick={toggle}
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

          <div className="menu-section" role="group" aria-label="Switch demonstration persona">
            <p className="menu-label">Viewing as</p>
            {personas.map((persona) => {
              const selected = persona.name === context.persona;
              return (
                <button
                  key={persona.name}
                  className={`menu-item ${selected ? "menu-item--selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => switchPersona(persona)}
                >
                  <span className="avatar avatar--small">{initials(persona.name)}</span>
                  <span className="menu-item__copy"><strong>{persona.name}</strong><small>{persona.role}</small></span>
                  {selected ? <Check size={16} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>

          <div className="menu-section">
            <Link className="menu-item" href="/admin" onClick={close}>
              <span className="menu-item__icon"><Layers3 size={16} /></span>
              <span className="menu-item__copy"><strong>Subscription</strong><small>{tierLabel(context.tier)}</small></span>
            </Link>
            {inField ? (
              <Link className="menu-item" href="/overview" onClick={close}>
                <span className="menu-item__icon"><Monitor size={16} /></span>
                <span className="menu-item__copy"><strong>Back to desktop view</strong><small>Command Centre</small></span>
              </Link>
            ) : entitlementsFor(context.tier).mobile ? (
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
            <Link className="menu-item" href="/demo" onClick={close}>
              <span className="menu-item__icon"><SlidersHorizontal size={16} /></span>
              <span className="menu-item__copy"><strong>Demonstration setup</strong><small>Persona, scenario and subscription</small></span>
            </Link>
          </div>

          <div className="menu-section menu-section--footer">
            {confirmReset ? (
              <div className="menu-confirm" role="alertdialog" aria-label="Confirm reset">
                <p>Reset every fictional record to its starting state? Changes you made in this session will be lost.</p>
                <div className="button-row">
                  <button className="button button--quiet" onClick={() => setConfirmReset(false)}>Keep changes</button>
                  <button className="button button--danger" onClick={() => reset.mutate()} disabled={reset.isPending}>
                    {reset.isPending ? "Resetting…" : "Reset records"}
                  </button>
                </div>
              </div>
            ) : (
              <button className="menu-item" onClick={() => setConfirmReset(true)}>
                <span className="menu-item__icon"><RotateCcw size={16} /></span>
                <span className="menu-item__copy"><strong>Reset fictional records</strong><small>Return all demo data to the start</small></span>
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
