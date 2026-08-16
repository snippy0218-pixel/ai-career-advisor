// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PersonalizedMatchAdvisor } from "./personalized-match-advisor";
import {
  CANDIDATE_PROFILE_STORAGE_KEY,
  CANDIDATE_PROFILE_STORAGE_VERSION,
  sha256Hex,
} from "@/lib/candidate-profile-storage";
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

describe("saved profile prefill", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function storeProfile() {
    localStorage.setItem(
      CANDIDATE_PROFILE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: CANDIDATE_PROFILE_STORAGE_VERSION,
        updatedAt: "2026-08-16T00:00:00.000Z",
        rawText: profileText,
        rawTextSha256: sha256Hex(profileText),
      }),
    );
  }

  it("prefills the profile textarea from a saved profile without analyzing", async () => {
    storeProfile();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PersonalizedMatchAdvisor />);
    await waitFor(() =>
      expect(screen.getByLabelText("候选人资料")).toHaveValue(profileText),
    );
    expect(screen.getByText(/已加载「我的个人档案」/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a create-profile link when nothing is saved", async () => {
    render(<PersonalizedMatchAdvisor />);
    expect(await screen.findByText(/还没有常用资料？/)).toBeInTheDocument();
    expect(screen.getByLabelText("候选人资料")).toHaveValue("");
  });

  it("clears the saved profile and textarea after confirmation", async () => {
    storeProfile();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PersonalizedMatchAdvisor />);
    await waitFor(() =>
      expect(screen.getByLabelText("候选人资料")).toHaveValue(profileText),
    );
    fireEvent.click(screen.getByRole("button", { name: "清除已保存档案" }));
    await waitFor(() =>
      expect(screen.getByLabelText("候选人资料")).toHaveValue(""),
    );
    expect(localStorage.getItem(CANDIDATE_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it("keeps the textarea editable after prefill", async () => {
    storeProfile();
    render(<PersonalizedMatchAdvisor />);
    await waitFor(() =>
      expect(screen.getByLabelText("候选人资料")).toHaveValue(profileText),
    );
    const edited = `${profileText} 补充说明`;
    fireEvent.change(screen.getByLabelText("候选人资料"), {
      target: { value: edited },
    });
    expect(screen.getByLabelText("候选人资料")).toHaveValue(edited);
  });
});

describe("profile entry card", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the unsaved state with an add-profile link when nothing is stored", async () => {
    render(<PersonalizedMatchAdvisor />);
    expect(await screen.findByText("我的个人档案")).toBeInTheDocument();
    expect(screen.getByText("尚未设置")).toBeInTheDocument();
    const addLink = screen.getByRole("link", {
      name: "添加我的个人信息",
    });
    expect(addLink).toHaveAttribute("href", "/profile");
  });

  it("shows the saved state with update time and an edit link", async () => {
    localStorage.setItem(
      CANDIDATE_PROFILE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: CANDIDATE_PROFILE_STORAGE_VERSION,
        updatedAt: "2026-08-16T00:00:00.000Z",
        rawText: profileText,
        rawTextSha256: sha256Hex(profileText),
      }),
    );
    render(<PersonalizedMatchAdvisor />);
    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(screen.getAllByText(/更新于/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("我的个人档案").length).toBeGreaterThan(0);
    const editLink = screen.getByRole("link", { name: "编辑我的信息" });
    expect(editLink).toHaveAttribute("href", "/profile");
  });
});
