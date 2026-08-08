"use client";

import { useState } from "react";

import { MAX_PROFILE_LENGTH, MIN_PROFILE_LENGTH } from "@/lib/profile-schema";

export default function ProfilePage() {
  const [profileText, setProfileText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const trimmedLength = profileText.trim().length;
  const isTooLong = trimmedLength > MAX_PROFILE_LENGTH;
  const canSubmit =
    trimmedLength >= MIN_PROFILE_LENGTH && !isTooLong && !isLoading;

  async function onSubmit() {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/profile/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileText }),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) {
        setError(
          payload.error?.message ?? `请求失败（HTTP ${response.status}）`,
        );
        return;
      }
      setResult(JSON.stringify(payload.data, null, 2));
    } catch {
      setError("网络或服务异常，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f2f7f3] to-[#e7f0ea] px-4 py-10 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-emerald-700 uppercase">
          Phase 2.1 · Candidate Profile Foundation
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
          候选人资料结构化
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          粘贴你的教育、经历、项目、技能等原始资料。系统只会把「你写出的内容」整理为结构化事实，不会补全或推断。
        </p>

        <section className="mt-6 rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(31,52,42,0.10)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-xl font-semibold text-slate-950">
              粘贴候选人资料
            </h2>
            <p
              className={`text-xs tabular-nums ${
                isTooLong ? "font-semibold text-red-600" : "text-slate-500"
              }`}
            >
              {trimmedLength.toLocaleString()} /{" "}
              {MAX_PROFILE_LENGTH.toLocaleString()} 字符
            </p>
          </div>

          <textarea
            value={profileText}
            onChange={(event) => setProfileText(event.target.value)}
            disabled={isLoading}
            rows={12}
            placeholder="例如：计算机本科，应届生，了解 Python。参与过团队推荐系统课程项目。"
            className="mt-5 w-full resize-y rounded-2xl border border-slate-200 bg-[#fbfcfa] px-4 py-4 text-[15px] leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-70"
          />

          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="mt-5 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "结构化中…" : "开始结构化"}
          </button>
          {isTooLong && (
            <p className="mt-3 text-xs font-semibold text-red-600">
              超出输入限制（{MAX_PROFILE_LENGTH.toLocaleString()} 字符），请缩减后重试；系统不会静默截断。
            </p>
          )}
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-4">
            <pre className="max-h-[70vh] overflow-auto text-xs leading-5 text-emerald-100">
              {result}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
