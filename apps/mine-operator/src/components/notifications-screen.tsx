"use client";

/**
 * Every notification for the signed-in person: unread first in the top bar, all of them here, each opening the record it is about.
 */
import { NotificationList, useNotifications } from "@core/components/notification-list";
import { PageHeader } from "@core/components/page-header";
import { ErrorState, LoadingState } from "@core/components/query-state";

export function NotificationsScreen() {
  const notifications = useNotifications();
  if (notifications.isPending) return <LoadingState variant="panel" />;
  if (notifications.isError) return <ErrorState message="Notifications could not be loaded." />;
  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="For you"
        title="Notifications"
        description="Alerts about the records you own or follow. Each opens the record it is about."
        action={notifications.unread ? <button className="button button--quiet" onClick={notifications.readAll} disabled={notifications.readAllPending}>Mark all read</button> : undefined}
      />
      <section className="card notifications-card">
        <NotificationList roomy items={notifications.items} onToggleRead={notifications.toggleRead} onDismiss={notifications.dismiss} onOpen={notifications.markRead} />
      </section>
    </div>
  );
}
