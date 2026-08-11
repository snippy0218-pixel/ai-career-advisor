export const ACCEPTANCE_PREFLIGHT_REQUEST_HEADER =
  "x-phase-2-acceptance-preflight";
export const ACCEPTANCE_PREFLIGHT_RESPONSE_HEADER =
  "x-phase-2-acceptance-capability";
export const ACCEPTANCE_DIAGNOSTICS_ERROR =
  "ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE";

interface AcceptancePreflightOptions {
  module: string;
  enabled: boolean;
  requestId: string;
}

/**
 * Acceptance-only capability probe. It runs before request parsing and before
 * any model adapter can be invoked. Ordinary production requests do not enter
 * this branch.
 */
export function handleAcceptanceDiagnosticsPreflight(
  request: Request,
  { module, enabled, requestId }: AcceptancePreflightOptions,
): Response | null {
  if (request.headers.get(ACCEPTANCE_PREFLIGHT_REQUEST_HEADER) !== "1") {
    return null;
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Request-ID": requestId,
    [ACCEPTANCE_PREFLIGHT_RESPONSE_HEADER]: enabled ? "enabled" : "disabled",
  };
  if (enabled) {
    return Response.json(
      {
        data: {
          module,
          acceptanceDiagnostics: "enabled",
          rejectedOutputCapture: true,
        },
        error: null,
      },
      { status: 200, headers },
    );
  }

  return Response.json(
    {
      data: null,
      error: {
        code: ACCEPTANCE_DIAGNOSTICS_ERROR,
        message: "Required acceptance diagnostics are not enabled.",
        request_id: requestId,
        retryable: false,
      },
    },
    { status: 503, headers },
  );
}
