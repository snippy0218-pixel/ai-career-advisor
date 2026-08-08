import { NextResponse } from "next/server";

import { ApiError, toPublicError } from "@/lib/api-errors";
import { analyzeProfileWithDeepSeek } from "@/lib/profile-deepseek";
import { analyzeProfileRequestSchema } from "@/lib/profile-schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const responseHeaders = { "X-Request-ID": requestId };

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
      onDiagnostics: (diagnostics) => {
        console.info("[profile] request diagnostics", {
          requestId,
          ...diagnostics,
        });
      },
    });

    return NextResponse.json(
      { data: profile, error: null },
      { headers: responseHeaders },
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
    return NextResponse.json(publicError.body, {
      status: publicError.status,
      headers: responseHeaders,
    });
  }
}
