"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ToastProvider } from "./toast-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

type BootstrapState = "loading" | "ready" | "error";

let workerStartPromise: Promise<unknown> | undefined;

function startDemoWorker() {
  workerStartPromise ??= import("@/mocks/browser").then(({ worker }) =>
    worker.start({
      onUnhandledRequest(request, print) {
        if (new URL(request.url).pathname.startsWith("/_demo/api/v1")) {
          print.error();
        }
      },
      serviceWorker: { url: "/mockServiceWorker.js" },
      quiet: true,
    }),
  );
  return workerStartPromise;
}

export function DemoProviders({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BootstrapState>("loading");

  useEffect(() => {
    let active = true;
    startDemoWorker()
      .then(() => active && setState("ready"))
      .catch((error: unknown) => {
        console.error("VESPER demo worker failed to start", error);
        if (active) setState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <main className="bootstrap-state" aria-live="polite">
        <div className="bootstrap-mark">V</div>
        <p>Preparing deterministic VESPER demo data…</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="bootstrap-state" role="alert">
        <div className="bootstrap-mark bootstrap-mark--error">!</div>
        <h1>Demo unavailable</h1>
        <p>The mock service could not start. No real endpoint was contacted.</p>
        <button className="button button--primary" onClick={() => window.location.reload()}>
          Retry demo setup
        </button>
      </main>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
