import { describe, expect, it, vi } from "vitest";
import { createTiingoPrices } from "./tiingo.js";

describe("createTiingoPrices", () => {
  it("asks for one Instrument's daily prices with the key in a header, never in the URL", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fetch = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      url = String(input);
      init = options;
      return Response.json([
        { date: "2026-10-16T00:00:00.000Z", close: 100.5, adjClose: 99 },
        { date: "2026-10-19T00:00:00.000Z", close: 101.25 },
      ]);
    });

    const closes = await createTiingoPrices({ apiKey: "secret-key", fetch }).closes("BNO", "2026-10-16", "2026-10-24");

    expect(url).toBe("https://api.tiingo.com/tiingo/daily/BNO/prices?startDate=2026-10-16&endDate=2026-10-24");
    expect(url).not.toContain("secret-key");
    expect(new Headers(init?.headers).get("authorization")).toBe("Token secret-key");
    expect(closes).toEqual([
      { date: "2026-10-16", close: 100.5 },
      { date: "2026-10-19", close: 101.25 },
    ]);
  });

  it("drops rows that are not a positive price", async () => {
    const fetch = vi.fn(async () => Response.json([{ date: "2026-10-16", close: -1 }, { date: "nope", close: 5 }, { foo: 1 }]));

    await expect(createTiingoPrices({ apiKey: "k", fetch }).closes("BNO", "2026-10-16", "2026-10-24")).resolves.toEqual([]);
  });

  it("fails loudly on an HTTP error", async () => {
    const fetch = vi.fn(async () => new Response("no", { status: 401 }));

    await expect(createTiingoPrices({ apiKey: "k", fetch }).closes("BNO", "2026-10-16", "2026-10-24")).rejects.toThrow("401");
  });
});
