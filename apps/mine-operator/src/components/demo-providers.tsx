"use client";

import { BrandLoader } from "./brand-loader";
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
    }).then(async (registration) => {
      // A hard reload (Ctrl+Shift+R) loads the page outside the worker's control, so requests would
      // reach the server instead of the in-browser service. Reload once so the worker takes over.
      if ("serviceWorker" in navigator && !navigator.serviceWorker.controller) {
        try {
          if (window.sessionStorage.getItem("vesper-worker-reload") !== "1") {
            window.sessionStorage.setItem("vesper-worker-reload", "1");
            window.location.reload();
            return new Promise<never>(() => {});
          }
        } catch {
          // Storage unavailable: carry on without the retry.
        }
      } else {
        try {
          window.sessionStorage.removeItem("vesper-worker-reload");
        } catch {
          // Ignore.
        }
      }
      return registration;
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
    return <BrandLoader />;
  }

  if (state === "error") {
    return (
      <main className="bootstrap-state" role="alert">
        <div className="bootstrap-mark bootstrap-mark--error">!</div>
        <h1>VESPER could not start</h1>
        <p>Reload the page. If it keeps happening, let your administrator know.</p>
        <button className="button button--primary" onClick={() => window.location.reload()}>
          Reload
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
