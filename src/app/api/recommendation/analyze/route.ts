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
  const responseHeaders = () => {
    const headers: Record<string, string> = { "X-Request-ID": requestId };
    if (
      process.env.RECOMMENDATION_ACCEPTANCE_DIAGNOSTICS === "1" &&
      diagnosticsForAcceptance !== null
    ) {
      headers["X-Recommendation-Acceptance-Diagnostics"] = Buffer.from(
        JSON.stringify(diagnosticsForAcceptance),
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
      onDiagnostics: (diagnostics) => {
        diagnosticsForAcceptance = diagnostics;
        console.info("[recommendation] request diagnostics", {
          requestId,
          ...diagnostics,
        });
      },
    });
    return NextResponse.json(
      { data: result, error: null },
      { headers: responseHeaders() },
    );
  } catch (error) {
    const publicError = toPublicError(error, requestId);
    return NextResponse.json(publicError.body, {
      status: publicError.status,
      headers: responseHeaders(),
    });
  }
}
