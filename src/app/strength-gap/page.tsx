"use client";

import { useState } from "react";

import type { FinalStrengthGap } from "@/lib/strength-gap-schema";

export default function StrengthGapPage() {
  const [matchCoreText, setMatchCoreText] = useState("");
  const [result, setResult] = useState<FinalStrengthGap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setResult(null);
    let matchCore: unknown;
    try {
      matchCore = JSON.parse(matchCoreText);
    } catch {
      setError("请输入有效的 validated Match Core JSON。");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/strength-gap/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchCore }),
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-emerald-700 uppercase">
          Phase 2.2B-2 · Strength + Gap Core
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          优势与差距派生
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          仅接收已验证的 Match Core；不会重新分析 JD/Profile，也不会生成 Recommendation 或 Greeting。
        </p>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <textarea
            aria-label="Validated Match Core JSON"
            value={matchCoreText}
            onChange={(event) => setMatchCoreText(event.target.value)}
            disabled={isLoading}
            rows={14}
            placeholder='粘贴 {"schemaVersion":"match-core-v1", ...}'
            className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-xs leading-5 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading || matchCoreText.trim().length === 0}
            className="mt-4 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isLoading ? "派生中…" : "生成 Strength + Gap"}
          </button>
        </section>

        {error && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="text-lg font-semibold text-emerald-950">Strengths</h2>
              {result.strengths.length === 0 ? (
                <p className="mt-3 text-sm text-emerald-800">当前没有足够证据形成有效 Strength。</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {result.strengths.map((entry) => (
                    <li key={entry.strengthId} className="rounded-2xl bg-white p-4 text-sm">
                      <p className="font-semibold text-emerald-900">{entry.statement}</p>
                      <p className="mt-2 text-xs text-emerald-700">
                        {entry.type} · {entry.matchRefs.join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-lg font-semibold text-amber-950">Gaps</h2>
              {result.gaps.length === 0 ? (
                <p className="mt-3 text-sm text-amber-800">当前没有经 Match Core 证明的 Gap。</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {result.gaps.map((entry) => (
                    <li key={entry.gapId} className="rounded-2xl bg-white p-4 text-sm">
                      <p className="font-semibold text-amber-950">{entry.statement}</p>
                      <p className="mt-2 text-slate-600">{entry.suggestedAction}</p>
                      <p className="mt-2 text-xs text-amber-700">
                        {entry.type} / {entry.actionType} · {entry.matchRefs.join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
