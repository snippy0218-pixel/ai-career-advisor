import { NextResponse } from "next/server";

import { ApiError, toPublicError } from "@/lib/api-errors";
import {
  analyzeStrengthGapWithDeepSeek,
  type StrengthGapDiagnostics,
} from "@/lib/strength-gap-deepseek";
import { strengthGapCoreRequestSchema } from "@/lib/strength-gap-schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const acceptanceDiagnosticsEnabled =
    process.env.STRENGTH_GAP_ACCEPTANCE_DIAGNOSTICS === "1";
  let diagnosticsForAcceptance: StrengthGapDiagnostics | null = null;
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
      const headerDiagnostics = Object.fromEntries(
        Object.entries(diagnosticsForAcceptance).filter(
          ([key]) => key !== "outputEvidence",
        ),
      );
      headers["X-Strength-Gap-Acceptance-Diagnostics"] = Buffer.from(
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
    const parsed = strengthGapCoreRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError("INVALID_INPUT", 400);

    const result = await analyzeStrengthGapWithDeepSeek(parsed.data, {
      requestId,
      captureRejectedEvidence: acceptanceDiagnosticsEnabled,
      onDiagnostics: (diagnostics) => {
        diagnosticsForAcceptance = diagnostics;
        const { outputEvidence, ...summaryDiagnostics } = diagnostics;
        console.info("[strength-gap] request diagnostics", {
          requestId,
          ...summaryDiagnostics,
          capturedOutputEvidenceCount: outputEvidence.length,
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
