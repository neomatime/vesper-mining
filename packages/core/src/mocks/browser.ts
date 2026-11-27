/**
 * Creates the mock service worker from the handlers. It is started once, in the browser, by DemoProviders.
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
