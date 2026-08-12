import { describe, expect, it } from "vitest";

import {
  buildRecommendationMessages,
  buildRecommendationRepairMessages,
} from "./recommendation-prompt";
import { buildRecommendationMatchCore } from "@/test/recommendation-fixtures";

const request = {
  matchCore: buildRecommendationMatchCore([
    { requirement: "A", requirementType: "core_requirement", status: "partial" },
    { requirement: "B", requirementType: "core_requirement", status: "partial" },
  ]),
};

describe("Recommendation status-ownership generation contract", () => {
  it("requires an explicit MI subject for every status phrase", () => {
    const system = buildRecommendationMessages(request)[0].content;
    expect(system).toContain("每一个 met/partial/unmet/unknown 状态短语");
    expect(system).toContain("MI-001、MI-003 均为 partial");
    expect(system).toContain("整体部分满足/总体已满足");
  });

  it("gives R-C repair a mandatory field-level rewrite", () => {
    const repair = buildRecommendationRepairMessages(
      request,
      { summary: "整体部分满足" },
      [
        {
          path: "summary",
          message: "ambiguous status phrase attribution: 部分满足",
          validationCode: "R-C_AMBIGUOUS_STATUS_ATTRIBUTION",
          validationLayer: "semantic_validation",
          rule: "R-C",
        },
      ],
    )[1].content;
    expect(repair).toContain("不得原样返回歧义句");
    expect(repair).toContain("不得改变 Match status");
  });
});
