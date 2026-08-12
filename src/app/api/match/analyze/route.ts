import { NextResponse } from "next/server";

import { ApiError, toPublicError } from "@/lib/api-errors";
import { handleAcceptanceDiagnosticsPreflight } from "@/lib/acceptance-diagnostics";
import { analyzeMatchWithDeepSeek, type MatchDiagnostics } from "@/lib/match-deepseek";
import { matchCoreRequestSchema } from "@/lib/match-schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let diagnosticsForAcceptance: MatchDiagnostics | null = null;
  const acceptanceDiagnosticsEnabled =
    process.env.MATCH_ACCEPTANCE_DIAGNOSTICS === "1";
  const preflight = handleAcceptanceDiagnosticsPreflight(request, {
    module: "match",
    enabled: acceptanceDiagnosticsEnabled,
    requestId,
  });
  if (preflight) return preflight;
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
        normalizedRepairOutput: undefined,
      };
      headers["X-Match-Acceptance-Diagnostics"] = Buffer.from(
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
    const parsed = matchCoreRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError("INVALID_INPUT", 400);

    const result = await analyzeMatchWithDeepSeek(parsed.data, {
      requestId,
      captureRejectedEvidence: acceptanceDiagnosticsEnabled,
      onDiagnostics: (diagnostics) => {
        diagnosticsForAcceptance = diagnostics;
        console.info("[match] request diagnostics", { requestId, ...diagnostics });
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
