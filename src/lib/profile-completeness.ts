/**
 * Phase 3.1 lightweight front-end completeness hints.
 *
 * This is advisory only: it never blocks analysis, never changes the
 * candidate-profile-v2 pipeline, and is not a scoring model. It simply checks
 * whether common sections are detectable in the raw profile text.
 */
export const PROFILE_COMPLETENESS_AREAS = [
  {
    id: "education",
    label: "教育背景",
    markers: [
      /教育/,
      /学历/,
      /本科/,
      /硕士/,
      /博士/,
      /大专/,
      /学位/,
      /在读/,
      /毕业/,
      /学校/,
    ],
  },
  {
    id: "skills",
    label: "技能",
    markers: [
      /技能/,
      /掌握/,
      /熟练/,
      /熟悉/,
      /了解/,
      /会使用/,
      /工具/,
    ],
  },
  {
    id: "projects",
    label: "项目经历",
    markers: [/项目/, /课题/, /作品/],
  },
  {
    id: "experience",
    label: "工作/实习经历",
    markers: [/实习/, /工作经历/, /工作经验/, /实践/, /就职/, /任职/, /在职/],
  },
  {
    id: "careerTarget",
    label: "求职目标",
    markers: [/求职/, /方向/, /目标/, /期望/, /意向/],
  },
] as const;

export type ProfileCompletenessAreaId =
  (typeof PROFILE_COMPLETENESS_AREAS)[number]["id"];

export interface ProfileCompleteness {
  present: ProfileCompletenessAreaId[];
  missing: ProfileCompletenessAreaId[];
  coverage: "complete" | "partial" | "minimal";
}

export function inspectProfileCompleteness(
  rawText: string,
): ProfileCompleteness {
  const present: ProfileCompletenessAreaId[] = [];
  for (const area of PROFILE_COMPLETENESS_AREAS) {
    if (area.markers.some((marker) => marker.test(rawText))) {
      present.push(area.id);
    }
  }
  const missing = PROFILE_COMPLETENESS_AREAS.filter(
    (area) => !present.includes(area.id),
  ).map((area) => area.id);
  const coverage =
    present.length === PROFILE_COMPLETENESS_AREAS.length
      ? "complete"
      : present.length === 0
        ? "minimal"
        : "partial";
  return { present, missing, coverage };
}
