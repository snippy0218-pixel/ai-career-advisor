"use client";

import Link from "next/link";

import { ProfileManager } from "@/components/profile-manager";

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f2f7f3] to-[#e7f0ea] px-4 py-10 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <nav className="flex items-center justify-between text-sm">
          <Link href="/" className="font-semibold text-emerald-800 hover:text-emerald-600">
            AI Career Advisor
          </Link>
          <Link href="/personalized-match" className="text-slate-500 hover:text-slate-800">
            个性化岗位匹配
          </Link>
        </nav>

        <p className="mt-10 text-xs font-semibold tracking-[0.2em] text-emerald-700 uppercase">
          我的个人档案 · 本地保存
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
          我的个人档案
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          保存后，AI 会在岗位分析时自动参考你的背景。查看、编辑并保存在本浏览器的原始个人信息；资料只保存在当前浏览器，不会上传或写入服务器。
        </p>

        <div className="mt-6">
          <ProfileManager />
        </div>
      </div>
    </main>
  );
}
