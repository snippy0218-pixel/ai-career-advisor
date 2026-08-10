import { NextResponse } from "next/server";

import { ApiError, toPublicError } from "@/lib/api-errors";
import {
  analyzeRecommendationWithDeepSeek,
  type RecommendationDiagnostics,
} from "@/lib/recommendation-deepseek";
import { recommendationCoreRequestSchema } from "@/lib/recommendation-schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let diagnosticsForAcceptance: RecommendationDiagnostics | null = null;
  const acceptanceDiagnosticsEnabled =
    process.env.RECOMMENDATION_ACCEPTANCE_DIAGNOSTICS === "1";
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
      headers["X-Recommendation-Acceptance-Diagnostics"] = Buffer.from(
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
    const parsed = recommendationCoreRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError("INVALID_INPUT", 400);

    const result = await analyzeRecommendationWithDeepSeek(parsed.data, {
      requestId,
      captureRejectedEvidence: acceptanceDiagnosticsEnabled,
      onDiagnostics: (diagnostics) => {
        diagnosticsForAcceptance = diagnostics;
        console.info("[recommendation] request diagnostics", {
          requestId,
          ...diagnostics,
        });
      },
    });
    return NextResponse.json(
      responseBody({ data: result, error: null }),
      { headers: responseHeaders() },
    );
  } catch (error) {
    const publicError = toPublicError(error, requestId);
    return NextResponse.json(responseBody(publicError.body), {
      status: publicError.status,
      headers: responseHeaders(),
    });
  }
}
