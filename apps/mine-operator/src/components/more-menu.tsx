"use client";

import { Ellipsis } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDismiss } from "./use-dismiss";

/** A "More" button that opens a short menu of secondary actions. */
export function MoreMenu({ children }: { children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  return (
    <div className="popover-anchor" ref={ref}>
      <button className="button button--quiet" data-menu-trigger aria-haspopup="true" aria-expanded={open} aria-label="More actions" onClick={() => setOpen((value) => !value)}>
        <Ellipsis /> More
      </button>
      {open ? <div className="popover popover--menu" role="group" aria-label="More actions"><div className="menu-section">{children(close)}</div></div> : null}
    </div>
  );
}
