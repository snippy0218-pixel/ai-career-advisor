"use client";

import { useState } from "react";

import type { FinalPersonalizedGreeting } from "@/lib/greeting-schema";

export default function PersonalizedGreetingPage() {
  const [requestText, setRequestText] = useState("");
  const [result, setResult] = useState<FinalPersonalizedGreeting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setResult(null);
    let requestBody: unknown;
    try {
      requestBody = JSON.parse(requestText);
    } catch {
      setError("请输入有效的 Personalized Greeting 请求 JSON。");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/greeting/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) {
        setError(payload.error?.message ?? `请求失败（HTTP ${response.status}）`);
        return;
      }
      setResult(payload.data);
    } catch {
      setError("网络或服务异常，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyGreeting() {
    if (!result) return;
    await navigator.clipboard.writeText(result.greeting);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-indigo-700 uppercase">
          Phase 2.3 · Personalized Greeting Core
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          个性化首轮招呼语
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          输入已验证的 Candidate Profile、Match、Recommendation 和可选 Strength；页面只展示经过验证的最终招呼语。
        </p>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <textarea
            aria-label="Personalized Greeting request JSON"
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            disabled={isLoading}
            rows={16}
            placeholder='粘贴 {"candidateProfile":..., "matchCore":..., "recommendation":..., "strengthGap":...}'
            className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-xs leading-5 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading || requestText.trim().length === 0}
            className="mt-4 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isLoading ? "生成中…" : "生成招呼语"}
          </button>
        </section>

        {error && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {result && (
          <section className="mt-6 rounded-3xl border border-indigo-200 bg-indigo-50 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-indigo-950">可复制招呼语</h2>
              <button
                type="button"
                onClick={copyGreeting}
                className="rounded-full border border-indigo-300 bg-white px-4 py-2 text-xs font-semibold text-indigo-700"
              >
                复制
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-800">
              {result.greeting}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
