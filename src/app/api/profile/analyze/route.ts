import { NextResponse } from "next/server";

import { ApiError, toPublicError } from "@/lib/api-errors";
import { analyzeProfileWithDeepSeek } from "@/lib/profile-deepseek";
import type { ProfileDiagnostics } from "@/lib/profile-deepseek";
import { analyzeProfileRequestSchema } from "@/lib/profile-schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let diagnosticsForAcceptance: ProfileDiagnostics | null = null;
  const acceptanceDiagnosticsEnabled =
    process.env.PROFILE_ACCEPTANCE_DIAGNOSTICS === "1";
  const responseBody = <T extends Record<string, unknown>>(body: T) =>
    acceptanceDiagnosticsEnabled && diagnosticsForAcceptance !== null
      ? { ...body, acceptanceDiagnostics: diagnosticsForAcceptance }
      : body;
  const responseHeaders = () => {
    const headers: Record<string, string> = { "X-Request-ID": requestId };
    if (
      acceptanceDiagnosticsEnabled &&
      diagnosticsForAcceptance !== null
    ) {
      const headerDiagnostics = {
        ...diagnosticsForAcceptance,
        outputEvidence: undefined,
      };
      headers["X-Profile-Acceptance-Diagnostics"] = Buffer.from(
        JSON.stringify(headerDiagnostics),
        "utf8",
      ).toString("base64url");
    }
    return headers;
  };

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("INVALID_INPUT", 400);
    }

    const parsedRequest = analyzeProfileRequestSchema.safeParse(body);
    if (!parsedRequest.success) {
      throw new ApiError("INVALID_INPUT", 400);
    }

    const profile = await analyzeProfileWithDeepSeek(parsedRequest.data, {
      requestId,
      captureRejectedEvidence: acceptanceDiagnosticsEnabled,
      onDiagnostics: (diagnostics) => {
        diagnosticsForAcceptance = diagnostics;
        console.info("[profile] request diagnostics", {
          requestId,
          ...diagnostics,
        });
      },
    });

    return NextResponse.json(
      responseBody({ data: profile, error: null }),
      { headers: responseHeaders() },
    );
  } catch (error) {
    const publicError = toPublicError(error, requestId);
    if (publicError.body.error.code === "INVALID_INPUT") {
      // P3: profile-specific wording (local to this route; shared ApiError
      // message stays untouched for the Phase 1 route).
      publicError.body.error.message =
        "请粘贴完整且长度合适的候选人资料。";
    }
    console.warn("[profile] request failed", {
      requestId,
      code: publicError.body.error.code,
      status: publicError.status,
      retryable: publicError.body.error.retryable,
    });
    return NextResponse.json(responseBody(publicError.body), {
      status: publicError.status,
      headers: responseHeaders(),
    });
  }
}
