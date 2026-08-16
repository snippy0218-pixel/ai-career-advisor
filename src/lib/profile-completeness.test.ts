import { describe, expect, it } from "vitest";

import {
  inspectProfileCompleteness,
  PROFILE_COMPLETENESS_AREAS,
} from "./profile-completeness";

describe("inspectProfileCompleteness", () => {
  it("reports minimal coverage for empty or unrelated text", () => {
    const empty = inspectProfileCompleteness("");
    expect(empty.coverage).toBe("minimal");
    expect(empty.present).toEqual([]);
    expect(empty.missing).toHaveLength(PROFILE_COMPLETENESS_AREAS.length);

    const unrelated = inspectProfileCompleteness("今天天气不错。");
    expect(unrelated.coverage).toBe("minimal");
  });

  it("reports complete coverage when all five areas are detectable", () => {
    const text =
      "教育背景：本科\n技能：熟悉 SQL\n项目：参与数据分析项目\n实习：6个月运营实习\n求职目标：数据分析方向";
    const result = inspectProfileCompleteness(text);
    expect(result.coverage).toBe("complete");
    expect(result.missing).toEqual([]);
    expect(result.present).toEqual([
      "education",
      "skills",
      "projects",
      "experience",
      "careerTarget",
    ]);
  });

  it("reports partial coverage with the missing areas listed", () => {
    const result = inspectProfileCompleteness("教育背景：本科\n技能：熟悉 SQL");
    expect(result.coverage).toBe("partial");
    expect(result.present).toEqual(["education", "skills"]);
    expect(result.missing).toEqual([
      "projects",
      "experience",
      "careerTarget",
    ]);
  });

  it("does not treat generic work wording as formal experience", () => {
    const result = inspectProfileCompleteness("教育背景：本科\n技能：熟悉 SQL");
    expect(result.missing).toContain("experience");
  });
});
