import { describe, expect, it } from "vitest";
import { SOURCES } from "./sources.js";

describe("SOURCES", () => {
  it("are a fixed list of https feeds with unique ids (no user-supplied URLs → no SSRF)", () => {
    const ids = SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const source of SOURCES) {
      expect(source.id).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(new URL(source.url).protocol).toBe("https:");
    }
  });
});
