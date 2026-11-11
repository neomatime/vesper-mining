export type ApiEnvelope<T> = {
  data: T;
  meta: { demo: true; generatedAt: string };
};

export async function demoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/_demo/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const payload = (await response.json()) as ApiEnvelope<T | { message?: string }>;
  if (!response.ok) {
    const message =
      typeof payload.data === "object" && payload.data !== null && "message" in payload.data
        ? payload.data.message
        : undefined;
    throw new Error(message ?? "This demo action could not be completed.");
  }
  return payload.data as T;
}
