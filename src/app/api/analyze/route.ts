import { NextResponse } from "next/server";

import { analyzeJobRequestSchema } from "@/lib/analysis-schema";
import { ApiError, toPublicError } from "@/lib/api-errors";
import { analyzeJobWithDeepSeek } from "@/lib/deepseek";

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

    const parsedRequest = analyzeJobRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      throw new ApiError("INVALID_INPUT", 400);
    }

    const analysis = await analyzeJobWithDeepSeek(parsedRequest.data, {
      requestId,
      onDiagnostics: (diagnostics) => {
        console.info("[analyze] request diagnostics", {
          requestId,
          ...diagnostics,
        });
      },
    });

    return NextResponse.json(
      { data: analysis, error: null },
      { headers: responseHeaders },
    );
  } catch (error) {
    const publicError = toPublicError(error, requestId);
    console.warn("[analyze] request failed", {
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
