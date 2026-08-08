import { MAX_JD_LENGTH, MIN_JD_LENGTH } from "@/lib/analysis-schema";

interface JdInputFormProps {
  jdText: string;
  isLoading: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function JdInputForm({
  jdText,
  isLoading,
  error,
  onChange,
  onSubmit,
}: JdInputFormProps) {
  const trimmedLength = jdText.trim().length;
  const isTooLong = trimmedLength > MAX_JD_LENGTH;
  const canSubmit =
    trimmedLength >= MIN_JD_LENGTH && !isTooLong && !isLoading;

  return (
    <section className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(31,52,42,0.10)] backdrop-blur sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-700 uppercase">
            第一步
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">
            粘贴招聘 JD
          </h2>
        </div>
        <p
          className={`text-xs tabular-nums ${
            isTooLong ? "font-semibold text-red-600" : "text-slate-500"
          }`}
        >
          {trimmedLength.toLocaleString()} / {MAX_JD_LENGTH.toLocaleString()} 字符
        </p>
      </div>

      <label htmlFor="jd-text" className="sr-only">
        招聘 JD 文本
      </label>
      <textarea
        id="jd-text"
        value={jdText}
        onChange={(event) => onChange(event.target.value)}
        disabled={isLoading}
        rows={14}
        maxLength={MAX_JD_LENGTH + 1}
        placeholder="请粘贴完整的岗位职责和任职要求……"
        className="mt-5 w-full resize-y rounded-2xl border border-slate-200 bg-[#fbfcfa] px-4 py-4 text-[15px] leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-70 sm:px-5"
        aria-describedby="jd-help jd-error"
      />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div id="jd-help" className="flex max-w-xl gap-2 text-xs leading-5 text-slate-500">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
          >
            <path
              d="M10 2.5 16 5v4.5c0 3.5-2.3 6.5-6 8-3.7-1.5-6-4.5-6-8V5l6-2.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="m7.5 10 1.5 1.5 3.5-4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span>
            建议至少 {MIN_JD_LENGTH} 字。请勿粘贴手机号、邮箱、身份证等不必要的个人信息。
          </span>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-emerald-800 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              正在分析
            </>
          ) : (
            <>
              开始分析
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </div>

      {error ? (
        <div
          id="jd-error"
          role="alert"
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}
