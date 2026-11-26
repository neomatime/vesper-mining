"use client";

import { useState } from "react";

/**
 * A figure that settles in when its value changes (for example after a refresh brings new data). The first render and unchanged
 * values do not move, so a dashboard is never busy for no reason.
 */
export function Tick({ value }: { value: React.ReactNode }) {
  const key = typeof value === "string" || typeof value === "number" ? String(value) : null;
  // The value first shown never animates; a different value settles in once.
  const [initial] = useState(key);
  if (key === null) return <>{value}</>;
  return <span key={key} className={key === initial ? undefined : "value-tick"}>{value}</span>;
}
