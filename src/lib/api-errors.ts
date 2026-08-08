export type ApiErrorCode =
  | "INVALID_INPUT"
  | "AI_AUTH_FAILED"
  | "AI_BALANCE_INSUFFICIENT"
  | "AI_RATE_LIMITED"
  | "AI_REQUEST_INVALID"
  | "AI_SERVICE_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_EMPTY_RESPONSE"
  | "AI_OUTPUT_INVALID"
  | "AI_CONTENT_BLOCKED";

const publicMessages: Record<ApiErrorCode, string> = {
  INVALID_INPUT: "请粘贴完整且长度合适的招聘信息。",
  AI_AUTH_FAILED: "分析服务配置异常，请检查本地 API 配置。",
  AI_BALANCE_INSUFFICIENT: "分析服务暂时不可用，请检查 API 账户余额。",
  AI_RATE_LIMITED: "当前分析请求较多，请稍后重试。",
  AI_REQUEST_INVALID: "分析服务配置异常，请检查请求配置。",
  AI_SERVICE_UNAVAILABLE: "分析服务暂时不可用，请稍后重试。",
  AI_TIMEOUT: "分析时间过长，请重新尝试。",
  AI_EMPTY_RESPONSE: "本次分析没有生成有效内容，请重新尝试。",
  AI_OUTPUT_INVALID: "本次分析生成失败，请重新尝试。",
  AI_CONTENT_BLOCKED: "当前内容无法完成分析。",
};

const userRetryable: Record<ApiErrorCode, boolean> = {
  INVALID_INPUT: false,
  AI_AUTH_FAILED: false,
  AI_BALANCE_INSUFFICIENT: false,
  AI_RATE_LIMITED: true,
  AI_REQUEST_INVALID: false,
  AI_SERVICE_UNAVAILABLE: true,
  AI_TIMEOUT: true,
  AI_EMPTY_RESPONSE: true,
  AI_OUTPUT_INVALID: true,
  AI_CONTENT_BLOCKED: false,
};

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    public readonly autoRetryable = false,
    public readonly retryable = userRetryable[code],
  ) {
    super(publicMessages[code]);
    this.name = "ApiError";
  }
}

export function toPublicError(error: unknown, requestId: string) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        data: null,
        error: {
          code: error.code,
          message: error.message,
          request_id: requestId,
          retryable: error.retryable,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      data: null,
      error: {
        code: "AI_SERVICE_UNAVAILABLE" as const,
        message: publicMessages.AI_SERVICE_UNAVAILABLE,
        request_id: requestId,
        retryable: true,
      },
    },
  };
}
