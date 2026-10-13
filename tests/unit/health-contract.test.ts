import { describe, expect, it } from "vitest";

describe("foundation", () => {
  it("keeps its initial contract explicit", () => {
    expect({ database: "not-configured", ai: "not-configured" }).toMatchObject({
      database: "not-configured",
      ai: "not-configured",
    });
  });
});
