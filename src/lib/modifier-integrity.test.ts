import { describe, expect, it } from "vitest";

import {
  findUnsupportedModifiers,
  stripUnsupportedModifiers,
} from "./modifier-integrity";

describe("Modifier Inference Contract", () => {
  it("rejects a frequency upgrade that is absent from evidence", () => {
    expect(
      findUnsupportedModifiers("可能需要频繁拜访客户", ["拜访客户"]),
    ).toEqual([{ category: "frequency", value: "频繁" }]);
  });

  it("allows an explicitly supported modifier", () => {
    expect(
      findUnsupportedModifiers("需要频繁拜访客户", ["需要频繁拜访客户"]),
    ).toEqual([]);
  });

  it("removes only unsupported modifiers without inventing replacement facts", () => {
    expect(
      stripUnsupportedModifiers("可能需要频繁拜访多个客户", ["拜访客户"]),
    ).toBe("可能需要拜访客户");
  });
});
