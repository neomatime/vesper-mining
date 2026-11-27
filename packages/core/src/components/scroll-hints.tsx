"use client";

import { useEffect } from "react";

/** Rows that scroll sideways: the administration tabs, tables and timelines. */
const SELECTOR = ".tabs, .table-wrap, .parts-table, .lifecycle";

function update(element: HTMLElement) {
  const room = element.scrollWidth - element.clientWidth;
  element.toggleAttribute("data-fade-left", room > 2 && element.scrollLeft > 2);
  element.toggleAttribute("data-fade-right", room > 2 && element.scrollLeft < room - 2);
}

/**
 * Scrollbars are hidden across VESPER, so a row that carries on past the screen edge would give no sign of it.
 * This marks which edges still have more to show, and the stylesheet fades those edges.
 */
export function ScrollHints() {
  useEffect(() => {
    const all = () => document.querySelectorAll<HTMLElement>(SELECTOR).forEach(update);
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches(SELECTOR)) update(target);
    };
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(all);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", all);
    all();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", all);
    };
  }, []);
  return null;
}
