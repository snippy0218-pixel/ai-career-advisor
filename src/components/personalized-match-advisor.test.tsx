// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonalizedMatchAdvisor } from "./personalized-match-advisor";
import { finalizeRawPersonalizedGreeting } from "@/lib/greeting-schema";
import { sampleJd, validAnalysis } from "@/test/fixtures";
import { GREETING_FIXTURES } from "@/test/greeting-fixtures";

const profileText =
  "统计学本科；在课程项目中使用 SQL 分析电商数据；与三人团队共同完成项目报告。";

function success(data: unknown) {
  return new Response(JSON.stringify({ data, error: null }), { status: 200 });
}

function completeFixture() {
  const fixture = GREETING_FIXTURES[0];
  if (!fixture.validRaw) throw new Error("expected personalized fixture");
  const greeting = finalizeRawPersonalizedGreeting(
    fixture.validRaw,
    fixture.request,
  ).data;
  if (!greeting) throw new Error("expected final greeting");
  return { ...fixture.request, greeting };
}

function fillInputs() {
  fireEvent.change(screen.getByLabelText("招聘 JD"), {
    target: { value: sampleJd },
  });
  fireEvent.change(screen.getByLabelText("候选人资料"), {
    target: { value: profileText },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PersonalizedMatchAdvisor", () => {
  it("requires both raw inputs before starting", () => {
    render(<PersonalizedMatchAdvisor />);
    expect(
      screen.getByRole("heading", { name: "这份岗位，适合现在的你吗？" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("招聘 JD")).toBeInTheDocument();
    expect(screen.getByLabelText("候选人资料")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "开始个性化匹配" }),
    ).toBeDisabled();
  });

  it("renders one complete validated result after all six stages", async () => {
    const fixture = completeFixture();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(success(validAnalysis))
      .mockResolvedValueOnce(success(fixture.candidateProfile))
      .mockResolvedValueOnce(success(fixture.matchCore))
      .mockResolvedValueOnce(success(fixture.recommendation))
      .mockResolvedValueOnce(success(fixture.strengthGap))
      .mockResolvedValueOnce(success(fixture.greeting));
    vi.stubGlobal("fetch", fetchMock);
    render(<PersonalizedMatchAdvisor />);
    fillInputs();

    fireEvent.click(screen.getByRole("button", { name: "开始个性化匹配" }));

    expect(await screen.findByTestId("personalized-match-result")).toBeInTheDocument();
    expect(screen.getByText("逐项匹配")).toBeInTheDocument();
    expect(screen.getByText("可以重点表达")).toBeInTheDocument();
    expect(screen.getByText("差距与下一步")).toBeInTheDocument();
    expect(screen.getByText("面试前建议确认")).toBeInTheDocument();
    expect(screen.getByText("可直接使用的开场白")).toBeInTheDocument();
    expect(screen.getByText(fixture.greeting.greeting)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("shows an actionable stage error, retains inputs, and exposes no partial result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(success(validAnalysis))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            error: {
              code: "AI_TIMEOUT",
              message: "分析时间过长",
              request_id: "profile-timeout-001",
              retryable: true,
            },
          }),
          { status: 504 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<PersonalizedMatchAdvisor />);
    fillInputs();

    fireEvent.click(screen.getByRole("button", { name: "开始个性化匹配" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("候选人事实阶段未完成");
    expect(alert).toHaveTextContent("错误编号：profile-timeout-001");
    expect(alert).toHaveTextContent("保留输入并重新分析");
    expect(screen.getByLabelText("招聘 JD")).toHaveValue(sampleJd);
    expect(screen.getByLabelText("候选人资料")).toHaveValue(profileText);
    expect(screen.queryByTestId("personalized-match-result")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears a prior result when either raw input changes", async () => {
    const fixture = completeFixture();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(success(validAnalysis))
        .mockResolvedValueOnce(success(fixture.candidateProfile))
        .mockResolvedValueOnce(success(fixture.matchCore))
        .mockResolvedValueOnce(success(fixture.recommendation))
        .mockResolvedValueOnce(success(fixture.strengthGap))
        .mockResolvedValueOnce(success(fixture.greeting)),
    );
    render(<PersonalizedMatchAdvisor />);
    fillInputs();
    fireEvent.click(screen.getByRole("button", { name: "开始个性化匹配" }));
    await screen.findByTestId("personalized-match-result");

    fireEvent.change(screen.getByLabelText("候选人资料"), {
      target: { value: `${profileText} 补充真实信息。` },
    });
    await waitFor(() =>
      expect(screen.queryByTestId("personalized-match-result")).not.toBeInTheDocument(),
    );
  });
});
