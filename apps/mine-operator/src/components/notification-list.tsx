"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Check, Undo2, X } from "lucide-react";
import Link from "next/link";
import { demoFetch, demoSend } from "@/lib/api";
import { useDemoContext } from "@/stores/demo-context";
import { useToast } from "./toast-provider";

export type DemoNotification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  unread: boolean;
  category: string;
};

/** Notifications for the current persona, with the actions both the menu and the mobile page share. */
export function useNotifications() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { context } = useDemoContext();
  const queryKey = ["notifications", context.siteId, context.persona];

  const query = useQuery({
    queryKey,
    queryFn: () => demoFetch<DemoNotification[]>("/notifications"),
  });

  const patch = useMutation({
    mutationFn: ({ id, ...body }: { id: string; read?: boolean; dismissed?: boolean }) =>
      demoSend<DemoNotification>(`/notifications/${id}`, "PATCH", body),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DemoNotification[]>(queryKey);
      queryClient.setQueryData<DemoNotification[]>(queryKey, (current = []) =>
        current
          .map((item) => (item.id === variables.id && variables.read !== undefined ? { ...item, unread: !variables.read } : item))
          .filter((item) => !(item.id === variables.id && variables.dismissed)),
      );
      return { previous };
    },
    onError: (_error, _variables, rollback) => {
      if (rollback?.previous) queryClient.setQueryData(queryKey, rollback.previous);
      toast.push({ tone: "error", title: "That notification could not be updated" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAll = useMutation({
    mutationFn: () => demoSend<DemoNotification[]>("/notifications/read-all", "POST"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const dismiss = (item: DemoNotification) =>
    patch.mutate(
      { id: item.id, dismissed: true },
      {
        onSuccess: () =>
          toast.push({
            tone: "info",
            title: "Notification dismissed",
            detail: item.title,
            action: { label: "Undo", onClick: () => patch.mutate({ id: item.id, dismissed: false }) },
          }),
      },
    );

  return {
    items: query.data ?? [],
    isPending: query.isPending,
    isError: query.isError,
    unread: (query.data ?? []).filter((item) => item.unread).length,
    toggleRead: (item: DemoNotification) => patch.mutate({ id: item.id, read: item.unread }),
    markRead: (item: DemoNotification) => item.unread && patch.mutate({ id: item.id, read: true }),
    dismiss,
    readAll: () => readAll.mutate(),
    readAllPending: readAll.isPending,
  };
}

export function NotificationList({
  items,
  onToggleRead,
  onDismiss,
  onOpen,
  roomy = false,
}: {
  items: DemoNotification[];
  onToggleRead: (item: DemoNotification) => void;
  onDismiss: (item: DemoNotification) => void;
  onOpen: (item: DemoNotification) => void;
  roomy?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="empty-inline empty-inline--centered">
        <BellOff aria-hidden="true" />
        <strong>You are up to date</strong>
        <span>New alerts about your issues, dependencies and handovers appear here.</span>
      </div>
    );
  }

  return (
    <ul className={`notification-list ${roomy ? "notification-list--roomy" : ""}`}>
      {items.map((item) => (
        <li key={item.id} className={`notification-item ${item.unread ? "notification-item--unread" : ""}`}>
          <Link href={item.href} onClick={() => onOpen(item)} className="notification-item__link">
            <span className="notification-item__icon"><Bell size={15} /></span>
            <span><strong>{item.title}</strong><small>{item.category} · {item.detail}</small></span>
          </Link>
          <div className="notification-item__actions">
            <button className="icon-button icon-button--light" onClick={() => onToggleRead(item)} aria-label={item.unread ? `Mark as read: ${item.title}` : `Mark as unread: ${item.title}`}>
              {item.unread ? <Check /> : <Undo2 />}
            </button>
            <button className="icon-button icon-button--light" onClick={() => onDismiss(item)} aria-label={`Dismiss: ${item.title}`}><X /></button>
          </div>
        </li>
      ))}
    </ul>
  );
}
