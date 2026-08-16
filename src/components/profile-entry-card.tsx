"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import {
  getProfileStorageSnapshot,
  subscribeToProfileStorage,
} from "@/lib/candidate-profile-storage";

/**
 * Homepage entry card for the saved personal profile. Reads the same
 * localStorage external store as /profile and /personalized-match; never
 * triggers analysis and never changes stored data.
 */
export function ProfileEntryCard() {
  const savedProfile = useSyncExternalStore(
    subscribeToProfileStorage,
    getProfileStorageSnapshot,
    getProfileStorageSnapshot,
  );
  const loaded = savedProfile.status === "loaded";
  const updatedLabel = loaded
    ? `更新于 ${new Date(savedProfile.updatedAt ?? "").toLocaleDateString(
        "zh-CN",
      )}`
    : null;

  return (
    <section
      aria-label="我的个人档案"
      className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-slate-950">
            {loaded ? "我的个人档案" : "尚未创建个人档案"}
          </p>
          {loaded ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              已保存
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {loaded
            ? updatedLabel
            : "保存你的教育背景、技能、项目经历，AI将在岗位分析时自动参考。"}
        </p>
      </div>
      <Link
        href="/profile"
        className="shrink-0 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
      >
        {loaded ? "编辑个人档案" : "创建我的个人档案"}
      </Link>
    </section>
  );
}
