"use client";

/**
 * Sends the outbox (stores/outbox.ts) once the person is back online: each item in the order it was recorded, as the person who
 * recorded it. Items that are refused keep their reason and stay in the outbox to be corrected or removed; the rest are removed
 * once received. Also used by the Send now button.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { ApiError, demoSend } from "../lib/api";
import { useDemoContext } from "../stores/demo-context";
import { useOutbox } from "../stores/outbox";
import { useToast } from "./toast-provider";

/** One send at a time for the whole page, however many screens use this hook. */
let sendingNow = false;

export function useOutboxSync() {
  const connectivity = useDemoContext((state) => state.connectivity);
  const persona = useDemoContext((state) => state.context.persona);
  const items = useOutbox((state) => state.items);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [sending, setSending] = useState(false);

  const send = useCallback(async () => {
    if (sendingNow || connectivity !== "online") return;
    const mine = useOutbox.getState().items.filter((item) => item.by === persona);
    if (!mine.length) return;
    sendingNow = true;
    setSending(true);
    let sent = 0;
    for (const item of mine) {
      try {
        await demoSend(item.path, "POST", item.body);
        useOutbox.getState().remove(item.id);
        sent += 1;
      } catch (error) {
        useOutbox.getState().failed(item.id, error instanceof ApiError ? error.message : "Could not be sent. It will be tried again.");
      }
    }
    sendingNow = false;
    setSending(false);
    if (sent) {
      await queryClient.invalidateQueries();
      toast.push({ title: sent === 1 ? "1 waiting record sent" : `${sent} waiting records sent`, detail: "They are now received centrally." });
    }
  }, [connectivity, persona, queryClient, toast]);

  // Back online with something waiting: send it.
  const waiting = items.some((item) => item.by === persona && !item.lastError);
  useEffect(() => {
    if (connectivity !== "online" || !waiting) return;
    const timer = window.setTimeout(() => void send(), 0);
    return () => window.clearTimeout(timer);
  }, [connectivity, waiting, send]);

  return { send, sending };
}
