import type { JobAnalysis, SourceType } from "@/lib/analysis-schema";

interface AnalysisResultProps {
  analysis: JobAnalysis;
}

const sourceLabels: Record<SourceType, string> = {
  jd_explicit: "JD 明示",
  inference: "AI 推断",
  to_verify: "需要确认",
};

const adviceLabels: Record<JobAnalysis["applicationAdvice"]["level"], string> = {
  worth_exploring: "值得进一步了解",
  consider_carefully: "建议谨慎评估",
  insufficient_information: "信息不足",
};

type ProfileItem = JobAnalysis["roleProfile"]["workCharacteristics"][number];
type RequirementItem = JobAnalysis["roleProfile"]["requirements"][number];

function SourceBadge({ type }: { type: SourceType }) {
  const styles = {
    jd_explicit: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
    inference: "bg-amber-50 text-amber-800 ring-amber-700/15",
    to_verify: "bg-rose-50 text-rose-800 ring-rose-700/15",
  }[type];

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles}`}>
      {sourceLabels[type]}
    </span>
  );
}

function Evidence({ items }: { items: string[] }) {
  return (
    <div className="mt-3 space-y-2">
      {items.map((item) => (
        <blockquote
          key={item}
          className="rounded-xl border-l-2 border-emerald-300 bg-emerald-50/70 px-3 py-2 text-xs leading-5 text-slate-600"
        >
          “{item}”
        </blockquote>
      ))}
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      <p className="text-[11px] font-semibold tracking-[0.18em] text-emerald-700 uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProfileList({ items }: { items: Array<ProfileItem | RequirementItem> }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">JD 未提供明确内容。</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={`${item.content}-${item.evidence[0]}`} className="rounded-2xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h4 className="font-semibold text-slate-900">{item.content}</h4>
            <SourceBadge type={item.sourceType} />
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.explanation}</p>
          <Evidence items={item.evidence} />
        </article>
      ))}
    </div>
  );
}

export function AnalysisResult({ analysis }: AnalysisResultProps) {
  const hardRequirements = analysis.roleProfile.requirements.filter(
    (item) => item.requirementType === "hard_requirement",
  );
  const coreRequirements = analysis.roleProfile.requirements.filter(
    (item) => item.requirementType === "core_requirement",
  );
  const preferredRequirements = analysis.roleProfile.requirements.filter(
    (item) => item.requirementType === "preferred_requirement",
  );
  const unclearRequirements = analysis.roleProfile.requirements.filter(
    (item) => item.requirementType === "unclear",
  );
  const infoItems = [
    ["岗位", analysis.basicInfo.jobTitle],
    ["公司", analysis.basicInfo.companyName],
    ["地点", analysis.basicInfo.location],
    ["用工类型", analysis.basicInfo.employmentType],
    ["薪资", analysis.basicInfo.salaryRange],
    ["经验要求", analysis.basicInfo.experienceRequirement],
    ["学历要求", analysis.basicInfo.educationRequirement],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  const adviceTone = {
    worth_exploring: "border-emerald-200 bg-emerald-50 text-emerald-900",
    consider_carefully: "border-amber-200 bg-amber-50 text-amber-950",
    insufficient_information: "border-slate-200 bg-slate-50 text-slate-800",
  }[analysis.applicationAdvice.level];

  return (
    <section className="mt-8" aria-labelledby="analysis-heading">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-700 uppercase">
            AI 分析结果
          </p>
          <h2 id="analysis-heading" className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
            这份岗位，拆开来看
          </h2>
        </div>
        <span className="hidden rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm sm:inline-flex">
          {analysis.schemaVersion}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard eyebrow="01 · Overview" title="岗位基本信息" className="lg:col-span-2">
          <p className="max-w-4xl text-base leading-7 text-slate-700">
            {analysis.basicInfo.summary}
          </p>
          <div className="mt-3">
            <SourceBadge type={analysis.basicInfo.summarySourceType} />
          </div>
          {infoItems.length > 0 ? (
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {infoItems.map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">JD 未明确提供基础信息。</p>
          )}
        </SectionCard>

        <SectionCard eyebrow="02 · Responsibilities" title="岗位核心职责" className="lg:col-span-2">
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.coreResponsibilities.map((item, index) => (
              <article key={`${item.title}-${item.evidence[0]}`} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{item.title}</h3>
                      <SourceBadge type={item.sourceType} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                    <Evidence items={item.evidence} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="03 · Must have" title="明确硬性要求">
          <ProfileList items={hardRequirements} />
        </SectionCard>

        <SectionCard eyebrow="04 · Capabilities" title="核心能力">
          <ProfileList items={coreRequirements} />
        </SectionCard>

        <SectionCard eyebrow="05 · Nice to have" title="加分项">
          <ProfileList items={preferredRequirements} />
        </SectionCard>

        <SectionCard eyebrow="06 · To verify" title="要求范围待确认">
          <ProfileList items={unclearRequirements} />
        </SectionCard>

        <SectionCard eyebrow="07 · Work style" title="工作特点">
          <ProfileList items={analysis.roleProfile.workCharacteristics} />
        </SectionCard>

        <SectionCard eyebrow="08 · Watch out" title="需要留意">
          <ProfileList items={analysis.roleProfile.riskSignals} />
        </SectionCard>

        <SectionCard eyebrow="09 · Unknowns" title="信息缺口">
          {analysis.roleProfile.unknowns.length > 0 ? (
            <ul className="space-y-2 text-sm leading-6 text-slate-700">
              {analysis.roleProfile.unknowns.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="text-amber-600">•</span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">暂未识别到明显信息缺口。</p>
          )}
        </SectionCard>

        <SectionCard eyebrow="10 · Advice" title="投递建议" className="lg:col-span-2">
          <div className={`rounded-2xl border px-4 py-4 ${adviceTone}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold tracking-wide uppercase">
                {adviceLabels[analysis.applicationAdvice.level]}
              </p>
              <SourceBadge type={analysis.applicationAdvice.sourceType} />
            </div>
            <p className="mt-2 text-base font-semibold leading-7">
              {analysis.applicationAdvice.summary}
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {analysis.applicationAdvice.reasons.map((reason) => (
              <article key={`${reason.content}-${reason.evidence[0]}`} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{reason.content}</p>
                  <SourceBadge type={reason.sourceType} />
                </div>
                <Evidence items={reason.evidence} />
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            {analysis.applicationAdvice.limitations}
          </p>
        </SectionCard>

        <SectionCard eyebrow="11 · Ask HR" title="建议确认的问题">
          {analysis.roleProfile.questionsToConfirm.length > 0 ? (
            <ol className="space-y-4">
              {analysis.roleProfile.questionsToConfirm.map((item, index) => (
                <li key={item.question} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-6 text-slate-900">{item.question}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">暂时没有额外确认问题。</p>
          )}
        </SectionCard>

        <SectionCard eyebrow="12 · Message" title="HR 打招呼消息">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
            {analysis.hrGreeting.personalizationNotice}
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">安全通用版</h3>
          <div className="rounded-2xl bg-slate-950 p-4 text-sm leading-7 text-slate-100">
            {analysis.hrGreeting.safeGreeting}
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">可编辑模板</h3>
          <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {analysis.hrGreeting.editableGreetingTemplate}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            未个性化 · 模板中的占位符必须按真实情况填写后再发送
          </p>
        </SectionCard>
      </div>
    </section>
  );
}
