// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JobAnalyzer } from "./job-analyzer";
import {
  CANDIDATE_PROFILE_STORAGE_KEY,
  CANDIDATE_PROFILE_STORAGE_VERSION,
  sha256Hex,
} from "@/lib/candidate-profile-storage";
import { sampleJd, validAnalysis } from "@/test/fixtures";

const savedProfileText =
  "教育背景：统计学本科；技能：日常使用 SQL；项目：课程项目中使用 SQL 分析电商数据；求职目标：数据分析方向。";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("JobAnalyzer", () => {
  it("renders the JD input and keeps submit disabled for empty content", () => {
    render(<JobAnalyzer />);

    expect(screen.getByRole("heading", { name: "看懂岗位，再决定下一步" })).toBeInTheDocument();
    expect(screen.getByLabelText("招聘 JD 文本")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /开始分析/ })).toBeDisabled();
  });

  it("submits a valid JD and displays analysis cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: validAnalysis, error: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(<JobAnalyzer />);

    fireEvent.change(screen.getByLabelText("招聘 JD 文本"), {
      target: { value: sampleJd },
    });
    fireEvent.click(screen.getByRole("button", { name: /开始分析/ }));

    expect(screen.getAllByText("正在分析").length).toBeGreaterThan(0);
    expect(await screen.findByText("岗位基本信息")).toBeInTheDocument();
    expect(screen.getByText("岗位核心职责")).toBeInTheDocument();
    expect(screen.getByText("HR 打招呼消息")).toBeInTheDocument();
    expect(screen.getByText("安全通用版")).toBeInTheDocument();
    expect(screen.getByText("可编辑模板")).toBeInTheDocument();
    expect(
      screen.getByText(
        "未提供个人资料，以下内容仅为通用沟通话术，不代表个人匹配结论。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/【学历\/专业】/)).toBeInTheDocument();
    expect(screen.queryByText("优势分析")).not.toBeInTheDocument();
  });

  it("shows the API error and keeps the original JD", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: null,
            error: {
              code: "AI_TIMEOUT",
              message: "分析时间过长，请重新尝试。",
              request_id: "req-timeout-001",
              retryable: true,
            },
          }),
          { status: 504, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(<JobAnalyzer />);

    const textarea = screen.getByLabelText("招聘 JD 文本");
    fireEvent.change(textarea, { target: { value: sampleJd } });
    fireEvent.click(screen.getByRole("button", { name: /开始分析/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("分析请求超时");
    expect(alert).toHaveTextContent("分析时间过长");
    expect(alert).toHaveTextContent("错误编号：req-timeout-001");
    expect(alert).toHaveTextContent("重新分析");
    expect(textarea).toHaveValue(sampleJd);
  });

  it("recovers when the user retries after a failed request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            error: {
              code: "AI_RATE_LIMITED",
              message: "服务繁忙",
              request_id: "req-busy-001",
              retryable: true,
            },
          }),
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: validAnalysis, error: null }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<JobAnalyzer />);

    fireEvent.change(screen.getByLabelText("招聘 JD 文本"), {
      target: { value: sampleJd },
    });
    fireEvent.click(screen.getByRole("button", { name: /开始分析/ }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: /开始分析/ }));
    await waitFor(() => expect(screen.getByText("岗位基本信息")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a friendly error when the service returns non-JSON content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("gateway error", { status: 502 })),
    );
    render(<JobAnalyzer />);

    fireEvent.change(screen.getByLabelText("招聘 JD 文本"), {
      target: { value: sampleJd },
    });
    fireEvent.click(screen.getByRole("button", { name: /开始分析/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "分析服务返回异常，请重新尝试。",
    );
  });
});

describe("homepage profile entry card", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the not-created state with a create link when nothing is stored", () => {
    render(<JobAnalyzer />);
    expect(screen.getByText("尚未创建个人档案")).toBeInTheDocument();
    expect(
      screen.getByText(
        "保存你的教育背景、技能、项目经历，AI将在岗位分析时自动参考。",
      ),
    ).toBeInTheDocument();
    const createLink = screen.getByRole("link", {
      name: "创建我的个人档案",
    });
    expect(createLink).toHaveAttribute("href", "/profile");
  });

  it("shows the saved state with update time and an edit link", () => {
    localStorage.setItem(
      CANDIDATE_PROFILE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: CANDIDATE_PROFILE_STORAGE_VERSION,
        updatedAt: "2026-08-16T00:00:00.000Z",
        rawText: savedProfileText,
        rawTextSha256: sha256Hex(savedProfileText),
      }),
    );
    render(<JobAnalyzer />);
    expect(screen.getByText("我的个人档案")).toBeInTheDocument();
    expect(screen.getByText(/更新于/)).toBeInTheDocument();
    const editLink = screen.getByRole("link", { name: "编辑个人档案" });
    expect(editLink).toHaveAttribute("href", "/profile");
  });

  it("keeps the JD analysis flow unchanged when the card is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: validAnalysis, error: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(<JobAnalyzer />);
    fireEvent.change(screen.getByLabelText("招聘 JD 文本"), {
      target: { value: sampleJd },
    });
    fireEvent.click(screen.getByRole("button", { name: /开始分析/ }));
    expect(await screen.findByText("岗位基本信息")).toBeInTheDocument();
  });
});
