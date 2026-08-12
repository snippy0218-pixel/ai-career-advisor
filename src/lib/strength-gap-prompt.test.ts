import { describe, expect, it } from "vitest";

import {
  buildStrengthGapMessages,
  buildStrengthGapRepairMessages,
} from "./strength-gap-prompt";
import { STRENGTH_GAP_FIXTURES } from "@/test/strength-gap-fixtures";

const request = { matchCore: STRENGTH_GAP_FIXTURES[6].matchCore };

describe("Strength/Gap optional transferable generation contract", () => {
  it("forbids cross-dimension ownership support and permits omission", () => {
    const system = buildStrengthGapMessages(request)[0].content;
    expect(system).toContain("不要求覆盖每个 transferableStrengthMatchRefs");
    expect(system).toContain("不得用协助/参与去支持 unknown 的主导");
    expect(system).toContain("就不要输出该 transferable_strength");
  });

  it("requires SG-B/SG-M repair to delete an irreparable optional relation", () => {
    const repair = buildStrengthGapRepairMessages(
      request,
      { strengths: [], gaps: [] },
      [
        {
          path: "strengths.0",
          message: "SG-M transferable relation boundary integrity failed",
        },
      ],
    )[1].content;
    expect(repair).toContain("必须删除整条 strength");
    expect(repair).toContain("而不是原样返回或只重排原句");
  });
});
