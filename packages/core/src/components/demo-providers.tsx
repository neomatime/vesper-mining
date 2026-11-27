"use client";

/**
 * Starts everything the app needs before the first screen: the TanStack Query client (30 second freshness, no automatic
 * retries) and the mock service worker that answers the demo API. Children render only when the worker is ready, so no screen
 * can call an API that is not there yet. A failed start shows an error screen instead of a half-working app.
 */
import { BrandLoader } from "./brand-loader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ToastProvider } from "./toast-provider";
import { reactivateDemoWorker } from "../lib/demo-worker";
// Imported for its side effect: it starts listening for the browser's install event as early as possible, because the browser sends it once.
import "../lib/install-prompt";

/** The shared data cache for every screen. Data is fresh for 30 seconds; failures show an error state instead of retrying silently. */
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

/** The worker starts once per page load. The promise is shared because development runs effects twice. */
let workerStartPromise: Promise<unknown> | undefined;

/**
 * Starts the mock service worker that answers /_demo/api/v1. Only requests under that path are checked; everything else
 * (pages, fonts, images) goes to the server as normal.
 */
function startDemoWorker() {
  workerStartPromise ??= import("../mocks/browser").then(({ worker }) =>
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

  // A tab left in the background may have had its demo service stopped. Wake it as soon as the person comes back.
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === "visible") void reactivateDemoWorker();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
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
