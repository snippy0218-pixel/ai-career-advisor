import type { JobAnalysis } from "./analysis-schema";
import type { FinalPersonalizedGreeting } from "./greeting-schema";
import type { FinalMatchCore } from "./match-schema";
import type { FinalProfileStructure } from "./profile-schema";
import type { FinalRecommendation } from "./recommendation-schema";
import type { FinalStrengthGap } from "./strength-gap-schema";

export const PERSONALIZED_MATCH_STAGES = [
  { id: "jd", label: "岗位解析" },
  { id: "profile", label: "候选人事实" },
  { id: "match", label: "逐项匹配" },
  { id: "recommendation", label: "投递建议" },
  { id: "strengthGap", label: "优势与差距" },
  { id: "greeting", label: "HR 开场白" },
] as const;

export type PersonalizedMatchStage =
  (typeof PERSONALIZED_MATCH_STAGES)[number]["id"];

export interface PersonalizedMatchResult {
  jobAnalysis: JobAnalysis;
  candidateProfile: FinalProfileStructure;
  matchCore: FinalMatchCore;
  recommendation: FinalRecommendation;
  strengthGap: FinalStrengthGap;
  greeting: FinalPersonalizedGreeting;
}

interface PublicApiError {
  code?: string;
  message?: string;
  request_id?: string;
  retryable?: boolean;
}

interface PublicApiResponse<T> {
  data?: T | null;
  error?: PublicApiError | null;
}

const ERROR_LABELS: Record<string, string> = {
  INVALID_INPUT: "输入内容未通过校验",
  AI_AUTH_FAILED: "分析服务配置异常",
  AI_BALANCE_INSUFFICIENT: "分析服务账户异常",
  AI_RATE_LIMITED: "分析服务繁忙",
  AI_REQUEST_INVALID: "分析服务请求异常",
  AI_SERVICE_UNAVAILABLE: "分析服务暂不可用",
  AI_TIMEOUT: "分析请求超时",
  AI_EMPTY_RESPONSE: "AI 未返回有效内容",
  AI_OUTPUT_INVALID: "结果未通过事实与证据校验",
  AI_CONTENT_BLOCKED: "当前内容无法分析",
};

export class PersonalizedMatchFlowError extends Error {
  constructor(
    readonly stage: PersonalizedMatchStage,
    message: string,
    readonly requestId: string | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PersonalizedMatchFlowError";
  }
}

async function postStage<T>(
  stage: PersonalizedMatchStage,
  path: string,
  body: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PersonalizedMatchFlowError(
      stage,
      "网络连接失败，请检查网络后重试。",
      null,
      true,
    );
  }

  const responseRequestId = response.headers.get("x-request-id");
  let payload: PublicApiResponse<T>;
  try {
    payload = (await response.json()) as PublicApiResponse<T>;
  } catch {
    throw new PersonalizedMatchFlowError(
      stage,
      "分析服务返回了无法读取的内容，请重新尝试。",
      responseRequestId,
      true,
    );
  }

  if (!response.ok || !payload.data) {
    const code = payload.error?.code ?? "UNKNOWN";
    const label = ERROR_LABELS[code] ?? "分析请求失败";
    const detail = payload.error?.message ? `：${payload.error.message}` : "。";
    throw new PersonalizedMatchFlowError(
      stage,
      `${label}${detail}`,
      payload.error?.request_id || responseRequestId,
      payload.error?.retryable ?? response.status >= 500,
    );
  }
  return payload.data;
}

export async function runPersonalizedMatchFlow(
  jdText: string,
  profileText: string,
  onStage?: (stage: PersonalizedMatchStage) => void,
): Promise<PersonalizedMatchResult> {
  onStage?.("jd");
  const jobAnalysis = await postStage<JobAnalysis>("jd", "/api/analyze", {
    jdText,
  });

  onStage?.("profile");
  const candidateProfile = await postStage<FinalProfileStructure>(
    "profile",
    "/api/profile/analyze",
    { profileText },
  );

  onStage?.("match");
  const matchCore = await postStage<FinalMatchCore>(
    "match",
    "/api/match/analyze",
    { jobAnalysis, candidateProfile },
  );

  onStage?.("recommendation");
  const recommendation = await postStage<FinalRecommendation>(
    "recommendation",
    "/api/recommendation/analyze",
    { matchCore },
  );

  onStage?.("strengthGap");
  const strengthGap = await postStage<FinalStrengthGap>(
    "strengthGap",
    "/api/strength-gap/analyze",
    { matchCore },
  );

  onStage?.("greeting");
  const greeting = await postStage<FinalPersonalizedGreeting>(
    "greeting",
    "/api/greeting/analyze",
    { candidateProfile, matchCore, recommendation, strengthGap },
  );

  return {
    jobAnalysis,
    candidateProfile,
    matchCore,
    recommendation,
    strengthGap,
    greeting,
  };
}
