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

import { ProfileManager } from "./profile-manager";
import {
  CANDIDATE_PROFILE_STORAGE_KEY,
  CANDIDATE_PROFILE_STORAGE_VERSION,
  sha256Hex,
} from "@/lib/candidate-profile-storage";

const validText =
  "教育背景：统计学本科\n技能：日常使用 SQL\n项目经历：课程项目中使用 SQL 分析电商数据\n求职目标：数据分析方向";

function storeProfile(text: string = validText) {
  localStorage.setItem(
    CANDIDATE_PROFILE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: CANDIDATE_PROFILE_STORAGE_VERSION,
      updatedAt: "2026-08-16T00:00:00.000Z",
      rawText: text,
      rawTextSha256: sha256Hex(text),
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ProfileManager", () => {
  it("shows an empty editor when no profile is saved", async () => {
    render(<ProfileManager />);
    expect(
      await screen.findByRole("heading", { name: "创建候选人档案" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("候选人档案内容")).toHaveValue("");
    expect(screen.getByRole("button", { name: "保存档案" })).toBeDisabled();
  });

  it("displays the saved profile in view mode", async () => {
    storeProfile();
    render(<ProfileManager />);
    expect(
      await screen.findByRole("heading", { name: "当前档案" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("教育背景：统计学本科")),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑档案" })).toBeInTheDocument();
  });

  it("edits and saves a profile with a fresh sha", async () => {
    storeProfile();
    render(<ProfileManager />);
    fireEvent.click(
      await screen.findByRole("button", { name: "编辑档案" }),
    );
    const textarea = screen.getByLabelText("候选人档案内容");
    const edited = `${validText}\n工作经历：暂无正式工作经历`;
    fireEvent.change(textarea, { target: { value: edited } });
    fireEvent.click(screen.getByRole("button", { name: "保存档案" }));
    expect(
      await screen.findByRole("heading", { name: "当前档案" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("档案已保存到本浏览器，后续「个性化岗位匹配」会自动载入。"),
    ).toBeInTheDocument();
    const stored = JSON.parse(
      localStorage.getItem(CANDIDATE_PROFILE_STORAGE_KEY) ?? "null",
    );
    expect(stored.rawText).toBe(edited);
    expect(stored.rawTextSha256).toBe(sha256Hex(edited));
  });

  it("does not save text that is too short", async () => {
    render(<ProfileManager />);
    const textarea = await screen.findByLabelText("候选人档案内容");
    fireEvent.change(textarea, { target: { value: "太短" } });
    expect(screen.getByRole("button", { name: "保存档案" })).toBeDisabled();
    expect(localStorage.getItem(CANDIDATE_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it("clears the profile only after confirmation", async () => {
    storeProfile();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ProfileManager />);
    fireEvent.click(
      await screen.findByRole("button", { name: "清除档案" }),
    );
    expect(confirmSpy).toHaveBeenCalled();
    expect(
      await screen.findByRole("heading", { name: "创建候选人档案" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(CANDIDATE_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it("keeps the profile when confirmation is declined", async () => {
    storeProfile();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ProfileManager />);
    fireEvent.click(
      await screen.findByRole("button", { name: "清除档案" }),
    );
    expect(
      await screen.findByRole("heading", { name: "当前档案" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(CANDIDATE_PROFILE_STORAGE_KEY)).not.toBeNull();
  });

  it("shows lightweight completeness hints with missing areas", async () => {
    render(<ProfileManager />);
    const textarea = await screen.findByLabelText("候选人档案内容");
    fireEvent.change(textarea, {
      target: { value: "教育背景：本科\n技能：熟悉 SQL" },
    });
    expect(screen.getByText("已覆盖 2 / 5 项")).toBeInTheDocument();
    expect(
      screen.getByText(/建议补充：项目经历、工作\/实习经历、求职目标/),
    ).toBeInTheDocument();
  });

  it("runs auxiliary AI structuring without persisting derived data", async () => {
    storeProfile();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { schemaVersion: "candidate-profile-v2" },
          error: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileManager />);
    fireEvent.click(
      await screen.findByRole("button", { name: "开始结构化" }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/profile/analyze",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(await screen.findByText(/candidate-profile-v2/)).toBeInTheDocument();
    const stored = JSON.parse(
      localStorage.getItem(CANDIDATE_PROFILE_STORAGE_KEY) ?? "null",
    );
    expect(stored.lastAnalysis).toBeUndefined();
  });

  it("degrades gracefully when localStorage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    render(<ProfileManager />);
    expect(
      await screen.findByRole("heading", { name: "创建候选人档案" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "当前浏览器无法使用本地存储",
    );
  });
});
