"use client";

import Link from "next/link";
import { useMemo, useReducer, useState, useSyncExternalStore } from "react";

import {
  clearProfile,
  getProfileStorageSnapshot,
  invalidateProfileStorageSnapshot,
  saveProfile,
  subscribeToProfileStorage,
} from "@/lib/candidate-profile-storage";
import {
  MAX_PROFILE_LENGTH,
  MIN_PROFILE_LENGTH,
} from "@/lib/profile-schema";
import {
  inspectProfileCompleteness,
  PROFILE_COMPLETENESS_AREAS,
  type ProfileCompleteness,
} from "@/lib/profile-completeness";

function CompletenessPanel({ completeness }: { completeness: ProfileCompleteness }) {
  const missingLabels = completeness.missing
    .map((id) => PROFILE_COMPLETENESS_AREAS.find((area) => area.id === id)?.label)
    .filter((label): label is NonNullable<typeof label> => Boolean(label));
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600">
          档案内容建议（仅前端提示，不影响分析）
        </p>
        <p className="text-xs tabular-nums text-slate-500">
          已覆盖 {completeness.present.length} /{" "}
          {PROFILE_COMPLETENESS_AREAS.length} 项
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {PROFILE_COMPLETENESS_AREAS.map((area) => {
          const present = completeness.present.includes(area.id);
          return (
            <span
              key={area.id}
              className={`rounded-full px-2.5 py-1 text-xs ${
                present
                  ? "bg-emerald-100 font-medium text-emerald-800"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {present ? "✓ " : "＋ "}
              {area.label}
            </span>
          );
        })}
      </div>
      {missingLabels.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          建议补充：{missingLabels.join("、")}
        </p>
      ) : (
        <p className="mt-2 text-xs leading-5 text-emerald-700">
          五项建议内容均已检测到，资料结构比较完整。
        </p>
      )}
    </div>
  );
}

export function ProfileManager() {
  const savedProfile = useSyncExternalStore(
    subscribeToProfileStorage,
    getProfileStorageSnapshot,
    getProfileStorageSnapshot,
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [, bumpRevision] = useReducer((value: number) => value + 1, 0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const loaded = savedProfile.status === "loaded";
  const storageError =
    savedProfile.status === "invalid"
      ? "本机保存的档案数据不完整或已损坏，已忽略；请重新输入并保存。"
      : savedProfile.status === "unavailable"
        ? "当前浏览器无法使用本地存储，档案仅在本次页面内有效。"
        : null;
  const editorOpen = editing || !loaded;
  const savedText = loaded ? (savedProfile.rawText ?? "") : "";
  const rawText = editorOpen ? (draft ?? savedText) : savedText;
  const updatedAt = loaded ? (savedProfile.updatedAt ?? null) : null;

  const trimmedLength = rawText.trim().length;
  const lengthError =
    trimmedLength > 0 && trimmedLength < MIN_PROFILE_LENGTH
      ? `档案至少需要 ${MIN_PROFILE_LENGTH} 个字符。`
      : trimmedLength > MAX_PROFILE_LENGTH
        ? `档案不能超过 ${MAX_PROFILE_LENGTH.toLocaleString()} 个字符。`
        : null;
  const canSave =
    trimmedLength >= MIN_PROFILE_LENGTH &&
    trimmedLength <= MAX_PROFILE_LENGTH;

  const completeness = useMemo(
    () => inspectProfileCompleteness(rawText),
    [rawText],
  );

  function refreshFromStorage() {
    invalidateProfileStorageSnapshot();
    bumpRevision();
  }

  function onSave() {
    const result = saveProfile(rawText);
    if (result.status === "saved") {
      refreshFromStorage();
      setEditing(false);
      setDraft(null);
      setNotice(
        "个人档案已保存到本浏览器，后续「个性化岗位匹配」会自动载入。",
      );
      setError(null);
    } else if (result.status === "invalid") {
      setError(result.reason);
    } else {
      setError("当前浏览器无法保存本地档案，请检查浏览器设置。");
    }
  }

  function onClear() {
    if (
      !window.confirm(
        "确定清除本浏览器中保存的候选人档案？此操作无法撤销。",
      )
    ) {
      return;
    }
    const result = clearProfile();
    if (result.status === "cleared") {
      refreshFromStorage();
      setEditing(false);
      setDraft(null);
      setAnalysisResult(null);
      setAnalysisError(null);
      setNotice("已清除本地档案。");
      setError(null);
    } else {
      setError("清除失败，当前浏览器无法使用本地存储。");
    }
  }

  async function onAnalyze() {
    const text = rawText.trim();
    if (text.length < MIN_PROFILE_LENGTH || text.length > MAX_PROFILE_LENGTH) {
      setAnalysisError(
        "档案长度需在 20–12,000 个字符之间才能进行结构化分析。",
      );
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    try {
      const response = await fetch("/api/profile/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileText: text }),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) {
        setAnalysisError(
          payload.error?.message ?? `请求失败（HTTP ${response.status}）`,
        );
        return;
      }
      setAnalysisResult(JSON.stringify(payload.data, null, 2));
    } catch {
      setAnalysisError("网络或服务异常，请稍后重试。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const updatedLabel = updatedAt
    ? `更新于 ${new Date(updatedAt).toLocaleString("zh-CN")}`
    : null;

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </div>
      ) : null}
      {storageError ?? error ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {storageError ?? error}
        </div>
      ) : null}

      {!editorOpen ? (
        <section className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(31,52,42,0.10)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">当前档案</h2>
              <p className="mt-1 text-xs text-slate-500">{updatedLabel}</p>
            </div>
            <p className="text-xs tabular-nums text-slate-500">
              {trimmedLength.toLocaleString()} 字符
            </p>
          </div>
          <pre className="mt-4 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-[#fbfcfa] p-4 text-sm leading-7 text-slate-800">
            {rawText}
          </pre>
          <CompletenessPanel completeness={completeness} />
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setDraft(savedText);
                setEditing(true);
              }}
              className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              编辑档案
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              清除档案
            </button>
            <Link
              href="/personalized-match"
              className="rounded-full border border-emerald-200 px-5 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              去个性化岗位匹配
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(31,52,42,0.10)] sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-xl font-semibold text-slate-950">
              {loaded ? "编辑个人档案" : "创建个人档案"}
            </h2>
            <p
              className={`text-xs tabular-nums ${
                lengthError ? "font-semibold text-rose-600" : "text-slate-500"
              }`}
            >
              {trimmedLength.toLocaleString()} /{" "}
              {MAX_PROFILE_LENGTH.toLocaleString()} 字符
            </p>
          </div>
          <textarea
            aria-label="候选人档案内容"
            value={rawText}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            rows={12}
            placeholder="例如：教育背景：统计学本科；技能：日常使用 SQL；项目：课程项目中使用 SQL 分析电商数据；求职目标：数据分析方向。"
            className="mt-4 w-full resize-y rounded-2xl border border-slate-200 bg-[#fbfcfa] px-4 py-4 text-[15px] leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />
          {lengthError ? (
            <p className="mt-3 text-xs font-semibold text-rose-600">
              {lengthError} 系统不会静默截断。
            </p>
          ) : null}
          <CompletenessPanel completeness={completeness} />
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              保存个人档案
            </button>
            {loaded ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(null);
                }}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                取消
              </button>
            ) : null}
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-sky-100 bg-sky-50/70 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-sky-700 uppercase">
              高级功能 · 可选
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              用 AI 结构化当前档案
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              只整理「你写出的内容」为可追溯事实，不会补全或推断；结果仅本次展示，不会写入本地档案。即使结构化失败，已保存的原始档案仍可直接用于岗位分析。
            </p>
          </div>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing || !canSave}
            className="shrink-0 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnalyzing ? "结构化中…" : "开始结构化"}
          </button>
        </div>
        {analysisError ? (
          <p className="mt-3 text-sm text-rose-700">{analysisError}</p>
        ) : null}
        {analysisResult ? (
          <pre className="mt-4 max-h-[60vh] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-emerald-100">
            {analysisResult}
          </pre>
        ) : null}
      </section>
    </div>
  );
}
