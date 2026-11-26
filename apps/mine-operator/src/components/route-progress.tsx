"use client";

/**
 * A hairline at the top of the screen that shows only while something is really loading: the next page after a link is followed,
 * or data refreshing in the background. It shows no percentage, because the app cannot know one, and it waits a moment before
 * appearing so fast changes do not flicker.
 */
import { useIsFetching } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function Progress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const here = `${pathname}?${search.toString()}`;
  const fetching = useIsFetching();
  // The address a followed link left from. While the address is still that one, the next page is on its way.
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setLeaving(`${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const busy = leaving === here || fetching > 0;
  // The short delay before it appears is in the stylesheet (transition-delay), so quick changes never flash.
  return <div className={`route-progress ${busy ? "is-active" : ""}`} aria-hidden="true" />;
}

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <Progress />
    </Suspense>
  );
}
