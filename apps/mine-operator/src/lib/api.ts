import { useDemoContext } from "@/stores/demo-context";

export type ApiEnvelope<T> = {
  data: T;
  meta: { demo: true; generatedAt: string };
};

/** A failed demo request. `code` lets screens tell a conflict from a permission or validation problem. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const ACTOR_HEADER = "x-demo-actor";

export async function demoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { persona, role } = useDemoContext.getState().context;
  const response = await fetch(`/_demo/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      [ACTOR_HEADER]: encodeURIComponent(JSON.stringify({ name: persona, role })),
      ...init?.headers,
    },
  });

  const payload = (await response.json()) as ApiEnvelope<T | { message?: string; code?: string }>;
  if (!response.ok) {
    const detail = typeof payload.data === "object" && payload.data !== null ? (payload.data as { message?: string; code?: string }) : {};
    throw new ApiError(detail.message ?? "This demo action could not be completed.", response.status, detail.code);
  }
  return payload.data as T;
}

/** Sends a JSON body with the given method. */
export function demoSend<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) {
  return demoFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}
