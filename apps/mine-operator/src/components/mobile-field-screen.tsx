"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  HardHat,
  MapPin,
  ShieldAlert,
  UserRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { initials, tierLabel } from "@/lib/personas";
import { useDemoContext } from "@/stores/demo-context";
import { NotificationList, useNotifications } from "./notification-list";
import { ErrorState, LoadingState } from "./query-state";
import { StatusBadge } from "./status-badge";

type Kind = "my-shift" | "my-work" | "notifications" | "profile";

export function MobileFieldScreen({ kind }: { kind: Kind }) {
  const { context, connectivity } = useDemoContext();
  const notifications = useNotifications();

  if (notifications.isPending && kind === "notifications") return <LoadingState />;
  if (notifications.isError && kind === "notifications") return <ErrorState message="Notifications could not be loaded." />;

  if (kind === "profile") {
    return (
      <div className="mobile-task-page">
        <div className="mobile-hero mobile-hero--profile"><span className="avatar avatar--large">{initials(context.persona)}</span><span className="eyebrow">Fictional demo persona</span><h1>{context.persona}</h1><p>{context.role} · {context.siteName}</p></div>
        <section className="mobile-stack">
          <article className="mobile-card"><UserRound /><div><small>Selected persona</small><strong>{context.role}</strong><p>Fictional user for this demonstration</p></div></article>
          <article className="mobile-card"><ShieldAlert /><div><small>Subscription</small><strong>{tierLabel(context.tier)}</strong><p>Role, site and entitlement guards apply</p></div></article>
          <article className="mobile-card"><CheckCircle2 /><div><small>Connection</small><strong>{connectivity === "online" ? "Demo online" : "Demo offline"}</strong><p>Browser simulation only</p></div></article>
        </section>
        <Link className="button button--quiet button--wide" href="/demo">Change demonstration context</Link>
      </div>
    );
  }

  if (kind === "notifications") {
    return (
      <div className="mobile-task-page">
        <div className="mobile-page-header">
          <span className="eyebrow">Role and site scoped</span>
          <h1>Notifications</h1>
          <p>Simulated alerts deep-link to their canonical records.</p>
          {notifications.unread ? <button className="button button--quiet button--small" onClick={notifications.readAll} disabled={notifications.readAllPending}>Mark all read</button> : null}
        </div>
        <NotificationList
          roomy
          items={notifications.items}
          onToggleRead={notifications.toggleRead}
          onDismiss={notifications.dismiss}
          onOpen={notifications.markRead}
        />
      </div>
    );
  }

  if (kind === "my-work") {
    return (
      <div className="mobile-task-page">
        <div className="mobile-page-header"><span className="eyebrow">Shift A · assigned work</span><h1>My Work</h1><p>Concise fictional tasks for the selected field persona.</p></div>
        <section className="mobile-stack">
          <Link className="mobile-card mobile-card--link" href="/exceptions/issue-riv-001"><Wrench /><div><StatusBadge value="in_progress" /><strong>Verify Crusher C-02 part availability</strong><p>Stores coordination · due 09:00 demo time</p></div><ArrowRight /></Link>
          <Link className="mobile-card mobile-card--link" href="/resources/readiness-ex204-1000h"><HardHat /><div><StatusBadge value="pending" /><strong>Review EX-204 service readiness</strong><p>Maintenance planning · this shift</p></div><ArrowRight /></Link>
          <article className="mobile-card"><CheckCircle2 /><div><StatusBadge value="complete" /><strong>North Pit pre-start observation</strong><p>Recorded at 06:18 demo time</p></div></article>
        </section>
      </div>
    );
  }

  return (
    <div className="mobile-task-page">
      <section className="mobile-hero">
        <span className="eyebrow">My Shift · DEMO</span>
        <h1>Good morning, {context.persona.split(" ")[0]}</h1>
        <p>Shift A · 06:00–14:00 · {context.siteName}</p>
        <div className="mobile-hero__facts"><span><Clock3 /> 5h 13m remaining</span><span><MapPin /> North Pit</span></div>
      </section>
      <section className="mobile-priority">
        <div><AlertTriangle /><span><small>Priority constraint</small><strong>Crusher C-02 feed interruption</strong><p>Awaiting spare-part confirmation. The area-wide impact is not verified.</p></span></div>
        <Link href="/exceptions/issue-riv-001">Track issue <ArrowRight /></Link>
      </section>
      <section className="mobile-actions">
        <Link href="/mobile/report"><AlertTriangle /><span><strong>Report</strong><small>Record an issue</small></span></Link>
        <Link href="/mobile/my-work"><Wrench /><span><strong>Act</strong><small>2 open tasks</small></span></Link>
        <Link href="/mobile/notifications"><Bell /><span><strong>Track</strong><small>2 unread alerts</small></span></Link>
      </section>
      <section className="mobile-stack"><h2>Shift attention</h2><article className="mobile-card"><ShieldAlert /><div><small>Information quality</small><strong>South Pit status requires confirmation</strong><p>Last observation is outside the demo freshness threshold.</p></div></article></section>
    </div>
  );
}
