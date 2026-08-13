import { describe, expect, it } from "vitest";

import { buildMatchFixture } from "@/test/match-fixtures";
import {
  buildMatchMessages,
  buildMatchRepairMessages,
  MATCH_PROMPT_VERSION,
  MATCH_REPAIR_PROMPT_VERSION,
} from "./match-prompt";

const request = buildMatchFixture(
  [{ content: "对个人交付结果负责", requirementType: "core_requirement" }],
  [
    {
      statement: "协助整理需求和测试",
      semanticTags: ["experience"],
    },
  ],
);

describe("Match generation-contract prompts", () => {
  it("P1 keeps raw and repair prompt versions aligned on candidate semantics", () => {
    expect(MATCH_PROMPT_VERSION).toBe("match-core-v1.6");
    expect(MATCH_REPAIR_PROMPT_VERSION).toBe("match-repair-v1.6");
    const initial = buildMatchMessages(request)[0].content;
    const repair = buildMatchRepairMessages(request, {}, [
      {
        path: "matchItems.0.dimensions.0.reason",
        message: "M-K cross-CF modifier isolation failed: ownership:个人->CF-001",
      },
    ])[0].content;
    for (const rule of [
      "unknown 不得叙述 positive CF id",
      "协助/参与/共同完成",
      "只有被引用 CF 自身明确包含对应 ownership/responsibility qualifier",
    ]) {
      expect(initial).toContain(rule);
      expect(repair).toContain(rule);
    }
  });

  it("P2 activates field-level repair actions for an M-K-only failure", () => {
    const messages = buildMatchRepairMessages(request, {}, [
      {
        path: "matchItems.0.dimensions.0.reason",
        message: "M-K cross-CF modifier isolation failed: ownership:个人->CF-001",
      },
    ]);
    expect(messages[1].content).toContain("字段级强制动作");
    expect(messages[1].content).toContain(
      "将该 dimension 改为 unknown、candidateEvidence=[]",
    );
    expect(messages[1].content).toContain("positive CF 不得使用此例外");
  });

  it("P3 does not retain the contradictory positive-CF unknown example", () => {
    const content = buildMatchRepairMessages(request, {}, [
      {
        path: "matchItems.0.dimensions.0.reason",
        message: "M-CANDIDATE-LINEAGE candidate factual assertion requires Candidate Fact lineage",
      },
    ])[1].content;
    expect(content).not.toContain(
      "候选人与四人团队共同完成数据展示作业并协助整理需求和测试，但现有证据不足以证明其担任主导角色",
    );
  });
});
