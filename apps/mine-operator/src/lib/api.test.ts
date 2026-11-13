import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactivate = vi.fn<() => Promise<boolean>>();
vi.mock("./demo-worker", () => ({ reactivateDemoWorker: () => reactivate() }));

import { ApiError, demoFetch } from "./api";

const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data, meta: { demo: true, generatedAt: "now" } }), { status, headers: { "content-type": "application/json" } });
const page = () => new Response("<!DOCTYPE html><html></html>", { status: 200, headers: { "content-type": "text/html" } });

describe("demoFetch when the in-browser demo service has stopped", () => {
  beforeEach(() => reactivate.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("wakes the service and asks again, so the person sees data and no error", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(page()).mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    reactivate.mockResolvedValue(true);
    await expect(demoFetch("/reports")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reactivate).toHaveBeenCalledTimes(1);
  });

  it("explains in plain words, never a parsing error, when the service cannot be woken", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page()));
    reactivate.mockResolvedValue(false);
    const failure = await demoFetch("/reports").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).message).toMatch(/Reload the page/);
    expect((failure as ApiError).message).not.toMatch(/JSON|DOCTYPE|token/i);
  });

  it("does nothing extra when the service answers normally", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([1, 2]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(demoFetch("/reports")).resolves.toEqual([1, 2]);
    expect(reactivate).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
