/**
 * The demo service runs inside the browser as a service worker. The browser may stop an idle worker, for example when a
 * tab sits in the background, and a restarted worker has forgotten which pages it serves, so it lets their requests
 * through to the web server, which answers with a web page instead of data. Telling the worker this page is still here
 * puts the demo service back in charge without a reload, and without losing what is on screen.
 */
export async function reactivateDemoWorker(timeoutMs = 1500): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const worker = registration?.active;
  if (!worker) return false;

  return new Promise<boolean>((resolve) => {
    const done = (result: boolean) => {
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("message", listen);
      resolve(result);
    };
    const listen = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === "MOCKING_ENABLED") done(true);
    };
    const timer = window.setTimeout(() => done(true), timeoutMs);
    navigator.serviceWorker.addEventListener("message", listen);
    worker.postMessage("MOCK_ACTIVATE");
  });
}
