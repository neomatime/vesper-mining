import { useEffect, type RefObject } from "react";

/** Closes a popover on outside pointer press or Escape, returning focus to its trigger. */
export function useDismiss(
  open: boolean,
  onClose: () => void,
  container: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      container.current?.querySelector<HTMLElement>("[data-menu-trigger]")?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, container]);
}
