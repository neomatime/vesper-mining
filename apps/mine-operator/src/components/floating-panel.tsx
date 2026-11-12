"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Placement = { top?: number; bottom?: number; left: number; width: number; maxHeight: number };

function computePlacement(element: HTMLElement | null, panel: HTMLElement | null, matchWidth: boolean, minWidth: number): Placement | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const width = Math.max(matchWidth ? rect.width : 0, minWidth, 0);
  const margin = 10;
  const below = window.innerHeight - rect.bottom - margin;
  const above = rect.top - margin;
  const wanted = panel?.scrollHeight ?? 280;
  const flip = below < Math.min(wanted, 420) && above > below;
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - Math.max(width, rect.width) - margin));
  return flip
    ? { bottom: window.innerHeight - rect.top + 6, left, width, maxHeight: Math.max(160, above - 6) }
    : { top: rect.bottom + 6, left, width, maxHeight: Math.max(160, below - 6) };
}

/**
 * One floating surface for every dropdown, calendar and time list in VESPER. It is drawn on the page,
 * not inside the form, so a dialog never clips it. It follows its anchor, flips above when there is no
 * room below, closes on an outside click, and closes on Escape without closing a dialog behind it.
 */
export function FloatingPanel({
  anchor,
  open,
  onClose,
  className = "",
  minWidth = 0,
  matchWidth = false,
  children,
  id,
  label,
  role,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  className?: string;
  minWidth?: number;
  matchWidth?: boolean;
  children: React.ReactNode;
  id?: string;
  label?: string;
  role?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    setPlacement(computePlacement(anchor.current, panel.current, matchWidth, minWidth));
  }, [open, anchor, matchWidth, minWidth, children]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => setPlacement(computePlacement(anchor.current, panel.current, matchWidth, minWidth));
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      onClose();
      (anchor.current?.querySelector("button, input") as HTMLElement | null)?.focus();
    };
    document.addEventListener("mousedown", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("mousedown", outside, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open, onClose, anchor, matchWidth, minWidth]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panel}
      id={id}
      role={role}
      aria-label={label}
      className={`floating-panel ${className}`}
      style={{ ...placement, width: placement?.width || undefined, visibility: placement ? "visible" : "hidden", maxHeight: placement?.maxHeight }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
