export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export type ErrorInfo = { description: string; retryable: boolean };

/** Map any thrown value to a short, actionable user-facing message. */
export function describeError(error: unknown): ErrorInfo {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return {
        description:
          "Token invalid or lacks permission (" +
          error.status +
          "). Check the API Token in extension settings.",
        retryable: false,
      };
    }
    if (error.status === 429) {
      const wait = error.retryAfter ? " after " + error.retryAfter + "s" : "";
      return {
        description: "Rate limited by Dida/TickTick. Retry" + wait + ".",
        retryable: true,
      };
    }
    if (error.status === 0) {
      return {
        description: "Network error. Check your connection and try again.",
        retryable: true,
      };
    }
    if (error.status >= 500) {
      return {
        description: "Server error (" + error.status + "). Try again later.",
        retryable: true,
      };
    }
    return { description: error.message, retryable: false };
  }
  if (error instanceof TypeError) {
    // Node/Raycast surface network failures as TypeError ("fetch failed").
    return {
      description: "Network error. Check your connection and try again.",
      retryable: true,
    };
  }
  if (error instanceof Error) {
    return { description: error.message, retryable: false };
  }
  return { description: String(error), retryable: false };
}
