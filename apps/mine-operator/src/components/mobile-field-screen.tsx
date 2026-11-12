"use client";

import { CheckCircle2, ShieldAlert, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { initials, tierLabel } from "@/lib/personas";
import { useDemoContext } from "@/stores/demo-context";
import { useSession } from "@/stores/session";
import { MyShiftScreen, MyWorkScreen } from "./mobile-shift-screens";
import { NotificationList, useNotifications } from "./notification-list";
import { ErrorState, LoadingState } from "./query-state";

type Kind = "my-shift" | "my-work" | "notifications" | "profile";

export function MobileFieldScreen({ kind }: { kind: Kind }) {
  const { context, connectivity } = useDemoContext();
  const router = useRouter();
  const signOut = useSession((state) => state.signOut);
  const notifications = useNotifications();

  if (notifications.isPending && kind === "notifications") return <LoadingState />;
  if (notifications.isError && kind === "notifications") return <ErrorState message="Notifications could not be loaded." />;

  if (kind === "profile") {
    return (
      <div className="mobile-task-page">
        <div className="mobile-hero mobile-hero--profile"><span className="avatar avatar--large">{initials(context.persona)}</span><span className="eyebrow">Signed in</span><h1>{context.persona}</h1><p>{context.role} · {context.siteName}</p></div>
        <section className="mobile-stack">
          <article className="mobile-card"><UserRound /><div><small>Role</small><strong>{context.role}</strong><p>Your access follows this role</p></div></article>
          <article className="mobile-card"><ShieldAlert /><div><small>Subscription</small><strong>{tierLabel(context.tier)}</strong><p>Role, site and entitlement guards apply</p></div></article>
          <article className="mobile-card"><CheckCircle2 /><div><small>Connection</small><strong>{connectivity === "online" ? "Online" : "Offline"}</strong><p>Your reports are saved on this device until they are received</p></div></article>
        </section>
        <button className="button button--quiet button--wide" onClick={() => { signOut(); router.replace("/sign-in"); }}>Sign out</button>
      </div>
    );
  }

  if (kind === "notifications") {
    return (
      <div className="mobile-task-page">
        <div className="mobile-page-header">
          <span className="eyebrow">Role and site scoped</span>
          <h1>Notifications</h1>
          <p>Alerts open the record they are about.</p>
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

  if (kind === "my-work") return <MyWorkScreen />;

  return <MyShiftScreen />;
}
