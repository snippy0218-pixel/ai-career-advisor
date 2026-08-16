"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import {
  MAX_JD_LENGTH,
  MIN_JD_LENGTH,
} from "@/lib/analysis-schema";
import {
  clearProfile,
  getProfileStorageSnapshot,
  invalidateProfileStorageSnapshot,
  subscribeToProfileStorage,
} from "@/lib/candidate-profile-storage";
import {
  PERSONALIZED_MATCH_STAGES,
  PersonalizedMatchFlowError,
  runPersonalizedMatchFlow,
  type PersonalizedMatchResult,
  type PersonalizedMatchStage,
} from "@/lib/personalized-match-flow";
import {
  MAX_PROFILE_LENGTH,
  MIN_PROFILE_LENGTH,
} from "@/lib/profile-schema";

const STATUS_STYLE = {
  met: { label: "已匹配", className: "bg-emerald-100 text-emerald-800" },
  partial: { label: "部分匹配", className: "bg-amber-100 text-amber-800" },
  unmet: { label: "明确不满足", className: "bg-rose-100 text-rose-800" },
  unknown: { label: "待确认", className: "bg-slate-200 text-slate-700" },
} as const;

const RECOMMENDATION_LABELS = {
  priority: "优先尝试",
  try: "值得尝试",
  cautious: "谨慎评估",
  not_recommended: "暂不建议",
} as const;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function CharacterCount({ value, max }: { value: string; max: number }) {
  const length = value.trim().length;
  return (
    <span
      className={
        length > max
          ? "font-semibold text-rose-700"
          : "text-slate-500"
      }
    >
      {length.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

function ResultView({ result }: { result: PersonalizedMatchResult }) {
  const facts = useMemo(
    () =>
      new Map(
        result.candidateProfile.candidateProfile.canonicalFacts.map((fact) => [
          fact.factId,
          fact.statement,
        ]),
      ),
    [result],
  );
  const questions = unique([
    ...result.candidateProfile.candidateProfile.questionsToConfirm.map(
      (item) => item.question,
    ),
    ...result.recommendation.questionsToConfirm.map((item) => item.question),
    ...result.matchCore.matchItems.flatMap((item) =>
      item.requirementDimensions.flatMap((dimension) =>
        dimension.verificationQuestion ? [dimension.verificationQuestion] : [],
      ),
    ),
  ]);

  async function copyGreeting() {
    await navigator.clipboard.writeText(result.greeting.greeting);
  }

  return (
    <div className="mt-8 space-y-6" data-testid="personalized-match-result">
      <section className="overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.20)] sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300 uppercase">
          个性化投递建议
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">
              {RECOMMENDATION_LABELS[result.recommendation.recommendationLevel]}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              {result.recommendation.summary}
            </p>
          </div>
          <span className="w-fit shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-200">
            {result.matchCore.matchItems.length} 项要求已核对
          </span>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-sm sm:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase">
              Requirement Match
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">逐项匹配</h2>
          </div>
          <p className="text-xs text-slate-500">事实均可追溯至你粘贴的原文</p>
        </div>
        <div className="mt-5 space-y-4">
          {result.matchCore.matchItems.map((item, itemIndex) => {
            const status = STATUS_STYLE[item.status];
            return (
              <article
                key={item.requirementId}
                className="rounded-2xl border border-slate-200 bg-[#fbfcfa] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      MI-{String(itemIndex + 1).padStart(3, "0")} · {item.requirementType}
                    </p>
                    <h3 className="mt-1 font-semibold leading-6 text-slate-900">
                      {item.requirement}
                    </h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {item.requirementDimensions.map((dimension) => (
                    <div key={dimension.dimensionId} className="border-l-2 border-slate-200 pl-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{dimension.dimensionType}</span>
                        <span>·</span>
                        <span>{STATUS_STYLE[dimension.status].label}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{dimension.reason}</p>
                      {dimension.candidateFactRefs.length > 0 ? (
                        <p className="mt-2 text-xs leading-5 text-emerald-800">
                          你的资料：{dimension.candidateFactRefs.map((ref) => facts.get(ref) ?? ref).join("；")}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        JD 原文：{dimension.jdEvidence.join("；")}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[28px] border border-emerald-100 bg-emerald-50/80 p-5 sm:p-7">
          <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase">Strengths</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">可以重点表达</h2>
          {result.strengthGap.strengths.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {result.strengthGap.strengths.map((strength) => (
                <li key={strength.strengthId} className="rounded-2xl bg-white/80 p-4 text-sm leading-6 text-slate-700">
                  {strength.statement}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">当前资料中没有足够证据形成可验证优势。</p>
          )}
        </section>

        <section className="rounded-[28px] border border-amber-100 bg-amber-50/80 p-5 sm:p-7">
          <p className="text-xs font-semibold tracking-[0.16em] text-amber-700 uppercase">Gaps</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">差距与下一步</h2>
          {result.strengthGap.gaps.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {result.strengthGap.gaps.map((gap) => (
                <li key={gap.gapId} className="rounded-2xl bg-white/80 p-4 text-sm leading-6 text-slate-700">
                  <p>{gap.statement}</p>
                  <p className="mt-2 text-xs text-amber-800">建议：{gap.suggestedAction}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">当前没有形成需要单独列出的差距。</p>
          )}
        </section>
      </div>

      <section className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-sky-700 uppercase">Questions</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">面试前建议确认</h2>
        {questions.length > 0 ? (
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {questions.map((question, index) => (
              <li key={question} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <span className="mr-2 font-semibold text-sky-700">{index + 1}.</span>
                {question}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-slate-600">当前没有新增待确认问题。</p>
        )}
      </section>

      <section className="rounded-[28px] border border-emerald-200 bg-white p-5 shadow-[0_20px_60px_rgba(16,185,129,0.10)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase">HR Greeting</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">可直接使用的开场白</h2>
            <p className="mt-1 text-xs text-slate-500">
              {result.greeting.personalizationStatus === "personalized"
                ? "已使用可追溯的候选人事实"
                : "当前没有安全的相关事实，已使用通用版本"}
            </p>
          </div>
          <button
            type="button"
            onClick={copyGreeting}
            className="rounded-full border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            复制开场白
          </button>
        </div>
        <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm leading-7 text-slate-800 sm:text-base">
          {result.greeting.greeting}
        </p>
      </section>
    </div>
  );
}

export function PersonalizedMatchAdvisor() {
  const [jdText, setJdText] = useState("");
  const [profileOverride, setProfileOverride] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<PersonalizedMatchStage | null>(null);
  const [result, setResult] = useState<PersonalizedMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const savedProfile = useSyncExternalStore(
    subscribeToProfileStorage,
    getProfileStorageSnapshot,
    getProfileStorageSnapshot,
  );
  const profileText =
    profileOverride ??
    (savedProfile.status === "loaded" ? (savedProfile.rawText ?? "") : "");

  const jdLength = jdText.trim().length;
  const profileLength = profileText.trim().length;
  const inputError =
    jdLength > 0 && jdLength < MIN_JD_LENGTH
      ? `招聘 JD 至少需要 ${MIN_JD_LENGTH} 个字符。`
      : jdLength > MAX_JD_LENGTH
        ? `招聘 JD 不能超过 ${MAX_JD_LENGTH.toLocaleString()} 个字符。`
        : profileLength > 0 && profileLength < MIN_PROFILE_LENGTH
          ? `候选人资料至少需要 ${MIN_PROFILE_LENGTH} 个字符。`
          : profileLength > MAX_PROFILE_LENGTH
            ? `候选人资料不能超过 ${MAX_PROFILE_LENGTH.toLocaleString()} 个字符。`
            : null;
  const canSubmit =
    jdLength >= MIN_JD_LENGTH &&
    jdLength <= MAX_JD_LENGTH &&
    profileLength >= MIN_PROFILE_LENGTH &&
    profileLength <= MAX_PROFILE_LENGTH &&
    !isLoading;
  const currentIndex = PERSONALIZED_MATCH_STAGES.findIndex(
    (stage) => stage.id === currentStage,
  );

  function updateInput(setter: (value: string) => void, value: string) {
    setter(value);
    setError(null);
    if (result) setResult(null);
  }

  function onRemoveSavedProfile() {
    if (
      !window.confirm(
        "确定清除本浏览器中保存的候选人档案？此操作无法撤销。",
      )
    ) {
      return;
    }
    const cleared = clearProfile();
    if (cleared.status === "cleared") {
      invalidateProfileStorageSnapshot();
      updateInput(setProfileOverride, "");
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const complete = await runPersonalizedMatchFlow(
        jdText.trim(),
        profileText.trim(),
        setCurrentStage,
      );
      setResult(complete);
    } catch (caught) {
      if (caught instanceof PersonalizedMatchFlowError) {
        const label = PERSONALIZED_MATCH_STAGES.find(
          (stage) => stage.id === caught.stage,
        )?.label;
        setError(
          `${label ? `${label}阶段未完成：` : ""}${caught.message} ${
            caught.retryable ? "你可以保留输入并重新分析。" : "请检查输入后再试。"
          }${caught.requestId ? ` 错误编号：${caught.requestId}` : ""}`,
        );
      } else {
        setError("分析未完成，请稍后重试。");
      }
    } finally {
      setIsLoading(false);
      setCurrentStage(null);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between text-sm">
          <Link href="/" className="font-semibold text-emerald-800 hover:text-emerald-600">
            AI Career Advisor
          </Link>
          <Link href="/" className="text-slate-500 hover:text-slate-800">
            只看 JD
          </Link>
        </nav>

        <header className="mx-auto mt-10 max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-emerald-900 shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            个性化岗位匹配
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
            这份岗位，适合现在的你吗？
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
            同时粘贴招聘 JD 和你的真实资料。系统会逐项核对证据，区分已匹配、部分匹配、明确不满足和待确认，不会把“没写”当成“不满足”。
          </p>
        </header>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/80 bg-white/80 p-5 shadow-sm">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-950">
                我的个人档案
              </p>
              {savedProfile.status === "loaded" ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  已保存
                </span>
              ) : (
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  尚未设置
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {savedProfile.status === "loaded"
                ? `更新于 ${new Date(
                    savedProfile.updatedAt ?? "",
                  ).toLocaleDateString("zh-CN")}；保存后，AI 会在岗位分析时自动参考你的背景。`
                : "保存后，AI 会在岗位分析时自动参考你的背景。"}
            </p>
          </div>
          <Link
            href="/profile"
            className="shrink-0 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            {savedProfile.status === "loaded"
              ? "编辑我的信息"
              : "添加我的个人信息"}
          </Link>
        </section>

        <section className="mt-8 rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(31,52,42,0.10)] backdrop-blur sm:p-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <label className="block">
              <span className="flex items-end justify-between gap-3">
                <span>
                  <span className="block text-lg font-semibold text-slate-950">招聘 JD</span>
                  <span className="mt-1 block text-xs text-slate-500">保留完整职责、要求和限定词</span>
                </span>
                <span className="text-xs tabular-nums"><CharacterCount value={jdText} max={MAX_JD_LENGTH} /></span>
              </span>
              <textarea
                aria-label="招聘 JD"
                value={jdText}
                onChange={(event) => updateInput(setJdText, event.target.value)}
                disabled={isLoading}
                rows={14}
                placeholder="粘贴完整招聘 JD（至少 100 字）"
                className="mt-4 w-full resize-y rounded-2xl border border-slate-200 bg-[#fbfcfa] px-4 py-4 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-70"
              />
            </label>

            <label className="block">
              <span className="flex items-end justify-between gap-3">
                <span>
                  <span className="block text-lg font-semibold text-slate-950">你的真实资料</span>
                  <span className="mt-1 block text-xs text-slate-500">教育、实习、工作、项目、技能与边界</span>
                </span>
                <span className="text-xs tabular-nums"><CharacterCount value={profileText} max={MAX_PROFILE_LENGTH} /></span>
              </span>
              <textarea
                aria-label="候选人资料"
                value={profileText}
                onChange={(event) => updateInput(setProfileOverride, event.target.value)}
                disabled={isLoading}
                rows={14}
                placeholder="例如：统计学本科；在课程项目中使用 SQL；尚无正式全职数据分析经验……"
                className="mt-4 w-full resize-y rounded-2xl border border-slate-200 bg-[#fbfcfa] px-4 py-4 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-70"
              />
              {savedProfile.status === "loaded" ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-800">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    已加载「我的个人档案」
                    <span className="text-emerald-700/70">
                      更新于{" "}
                      {new Date(savedProfile.updatedAt ?? "").toLocaleDateString(
                        "zh-CN",
                      )}
                    </span>
                  </span>
                  <Link
                    href="/profile"
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    编辑档案
                  </Link>
                  <button
                    type="button"
                    onClick={onRemoveSavedProfile}
                    className="font-semibold text-rose-600 underline-offset-2 hover:underline"
                  >
                    清除已保存档案
                  </button>
                </div>
              ) : savedProfile.status === "empty" || savedProfile.status === "invalid" ? (
                <div className="mt-3 text-xs text-slate-500">
                  {savedProfile.status === "invalid"
                    ? "本机档案数据不完整，尚未载入。"
                    : "还没有常用资料？"}{" "}
                  <Link
                    href="/profile"
                    className="font-semibold text-emerald-700 underline-offset-2 hover:underline"
                  >
                    {savedProfile.status === "invalid"
                      ? "去「我的个人档案」修复"
                      : "在「我的个人档案」中保存"}
                  </Link>
                </div>
              ) : null}
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {inputError ? <p className="text-xs font-semibold text-rose-700">{inputError}</p> : null}
              <p className="text-xs leading-5 text-slate-500">原文仅用于本次分析；结果通过结构、事实和证据校验后才会展示。</p>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="shrink-0 rounded-full bg-emerald-600 px-7 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "正在核对…" : "开始个性化匹配"}
            </button>
          </div>
        </section>

        <div aria-live="polite" aria-busy={isLoading}>
          {isLoading && currentStage ? (
            <section className="mt-6 rounded-[28px] border border-emerald-100 bg-emerald-50/80 p-5 sm:p-7">
              <div className="flex items-center gap-4">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />
                <div>
                  <p className="font-semibold text-emerald-950">
                    正在{PERSONALIZED_MATCH_STAGES[currentIndex].label}
                  </p>
                  <p className="mt-1 text-sm text-emerald-800/70">
                    第 {currentIndex + 1} / {PERSONALIZED_MATCH_STAGES.length} 步。完整结果通过全部校验后统一展示。
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PERSONALIZED_MATCH_STAGES.map((stage, index) => (
                  <span
                    key={stage.id}
                    className={`rounded-full px-2 py-1 text-center text-[11px] ${
                      index <= currentIndex
                        ? "bg-emerald-700 text-white"
                        : "bg-white/70 text-slate-500"
                    }`}
                  >
                    {stage.label}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {error ? (
            <section role="alert" className="mt-6 rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800">
              <p className="font-semibold">本次未生成个性化结果</p>
              <p className="mt-1">{error}</p>
            </section>
          ) : null}

          {result ? <ResultView result={result} /> : null}
        </div>

        <footer className="mt-10 text-center text-xs leading-5 text-slate-500">
          AI 分析仅作为求职辅助；“待确认”表示缺少证据，不代表你不满足岗位要求。
        </footer>
      </div>
    </main>
  );
}
