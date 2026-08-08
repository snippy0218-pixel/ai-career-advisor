"use client";

import { useState } from "react";

import { AnalysisResult } from "./analysis-result";
import { JdInputForm } from "./jd-input-form";
import {
  MAX_JD_LENGTH,
  MIN_JD_LENGTH,
  type JobAnalysis,
} from "@/lib/analysis-schema";

type ViewStatus = "idle" | "loading" | "success" | "error";

interface AnalyzeResponse {
  data: JobAnalysis | null;
  error: {
    code: string;
    message: string;
    request_id: string;
    retryable: boolean;
  } | null;
}

const errorTypeLabels: Record<string, string> = {
  INVALID_INPUT: "招聘信息格式有误",
  AI_AUTH_FAILED: "分析服务配置异常",
  AI_BALANCE_INSUFFICIENT: "分析服务账户异常",
  AI_RATE_LIMITED: "分析服务繁忙",
  AI_REQUEST_INVALID: "分析服务请求异常",
  AI_SERVICE_UNAVAILABLE: "分析服务暂不可用",
  AI_TIMEOUT: "分析请求超时",
  AI_EMPTY_RESPONSE: "AI 未返回有效内容",
  AI_OUTPUT_INVALID: "AI 分析结果未通过校验",
  AI_CONTENT_BLOCKED: "当前内容无法分析",
};

function formatApiError(
  error: AnalyzeResponse["error"],
  fallbackRequestId: string | null,
) {
  if (!error) {
    return `分析失败，请重新尝试。${
      fallbackRequestId ? ` 错误编号：${fallbackRequestId}` : ""
    }`;
  }

  const errorType = errorTypeLabels[error.code] ?? "分析请求失败";
  const suggestion = error.retryable
    ? "你可以保留当前 JD 并重新分析。"
    : "请检查输入或服务配置后再试。";
  const requestId = error.request_id || fallbackRequestId;

  return `${errorType}：${error.message} ${suggestion}${
    requestId ? ` 错误编号：${requestId}` : ""
  }`;
}

export function JobAnalyzer() {
  const [jdText, setJdText] = useState("");
  const [status, setStatus] = useState<ViewStatus>("idle");
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(value: string) {
    setJdText(value);
    setError(null);

    if (status === "success") {
      setAnalysis(null);
      setStatus("idle");
    }
  }

  async function handleSubmit() {
    const trimmedJd = jdText.trim();

    if (trimmedJd.length < MIN_JD_LENGTH) {
      setStatus("error");
      setError(`请粘贴至少 ${MIN_JD_LENGTH} 个字符的完整招聘 JD。`);
      return;
    }

    if (trimmedJd.length > MAX_JD_LENGTH) {
      setStatus("error");
      setError(`招聘 JD 不能超过 ${MAX_JD_LENGTH.toLocaleString()} 个字符。`);
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText: trimmedJd }),
      });
      const responseRequestId = response.headers.get("x-request-id");
      let payload: AnalyzeResponse;

      try {
        payload = (await response.json()) as AnalyzeResponse;
      } catch {
        throw new Error(
          `分析服务返回异常，请重新尝试。${
            responseRequestId ? ` 错误编号：${responseRequestId}` : ""
          }`,
        );
      }

      if (!response.ok || !payload.data) {
        throw new Error(formatApiError(payload.error, responseRequestId));
      }

      setAnalysis(payload.data);
      setStatus("success");
    } catch (caughtError) {
      setAnalysis(null);
      setStatus("error");
      setError(
        caughtError instanceof TypeError
          ? "网络连接失败，请检查网络后重试。"
          : caughtError instanceof Error
          ? caughtError.message
          : "网络连接失败，请检查网络后重试。",
      );
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-11">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-emerald-900 shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            面向求职新人的 JD 解读助手
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-6xl">
            看懂岗位，再决定下一步
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            粘贴招聘 JD，AI 会梳理真实职责、任职要求、风险信号和沟通重点。结论附带原文依据，不替你编造经历。
          </p>
        </header>

        <JdInputForm
          jdText={jdText}
          isLoading={status === "loading"}
          error={error}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />

        <div aria-live="polite" aria-busy={status === "loading"}>
          {status === "loading" ? (
            <section className="mt-6 rounded-[28px] border border-emerald-100 bg-emerald-50/80 px-5 py-6 sm:px-8">
              <div className="flex items-center gap-4">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />
                <div>
                  <p className="font-semibold text-emerald-950">正在拆解这份岗位</p>
                  <p className="mt-1 text-sm text-emerald-800/70">
                    正在核对职责、要求和原文证据，通常需要几十秒。
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {status === "success" && analysis ? (
            <AnalysisResult analysis={analysis} />
          ) : null}
        </div>

        <footer className="mt-10 text-center text-xs leading-5 text-slate-500">
          AI 分析仅作为求职辅助，不代表录用承诺或最终职业建议。
        </footer>
      </div>
    </main>
  );
}
