/**
 * tabEE error model.
 *
 * Errors cross a message boundary, so they are plain serializable objects,
 * not Error instances. `TabeeException` is the local, throwable counterpart.
 */
export const tabEE_ERROR_CODES = [
  // Transport and session establishment.
  "TARGET_URL_INVALID",
  "HTTPS_REQUIRED",
  "POPUP_BLOCKED",
  "POPUP_CLOSED",
  "OPENER_UNAVAILABLE",
  "HANDSHAKE_FAILED",
  "HANDSHAKE_TIMEOUT",
  "ORIGIN_MISMATCH",
  "PROTOCOL_MISMATCH",
  "VERSION_UNSUPPORTED",
  // Discovery and negotiation.
  "CAPABILITIES_INVALID",
  "NO_COMMON_FORMAT",
  "AMBIGUOUS_FORMAT",
  "SCHEMA_MISMATCH",
  "SIZE_EXCEEDED",
  "FILE_COUNT_EXCEEDED",
  // Transfer lifecycle.
  "OFFER_INVALID",
  "OFFER_UNKNOWN",
  "OFFER_EXPIRED",
  "TRANSFER_STATE_INVALID",
  "PAYLOAD_INVALID",
  "PAYLOAD_SIZE_MISMATCH",
  "IMPORT_FAILED",
  "REJECTED",
  "CANCELLED",
  "TIMED_OUT",
  "INTERNAL",
] as const;

export type TabeeErrorCode = (typeof tabEE_ERROR_CODES)[number];

export interface TabeeError {
  code: TabeeErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: TabeeError };

export class TabeeException extends Error {
  readonly code: TabeeErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(error: TabeeError) {
    super(error.message);
    this.name = "TabeeException";
    this.code = error.code;
    this.details = error.details;
  }

  toJSON(): TabeeError {
    return this.details
      ? { code: this.code, message: this.message, details: this.details }
      : { code: this.code, message: this.message };
  }
}

export function tabeeError(
  code: TabeeErrorCode,
  message: string,
  details?: Record<string, unknown>,
): TabeeError {
  return details ? { code, message, details } : { code, message };
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail(
  code: TabeeErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Result<never> {
  return { ok: false, error: tabeeError(code, message, details) };
}

/** Returns the value or throws `TabeeException`. Use at SDK boundaries only. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new TabeeException(result.error);
  return result.value;
}

export function isTabeeError(value: unknown): value is TabeeError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TabeeError).code === "string" &&
    typeof (value as TabeeError).message === "string" &&
    (tabEE_ERROR_CODES as readonly string[]).includes((value as TabeeError).code)
  );
}

export function asTabeeError(error: unknown, fallback: TabeeErrorCode = "INTERNAL"): TabeeError {
  if (isTabeeError(error)) return error;
  if (error instanceof TabeeException) return error.toJSON();
  if (error instanceof Error) {
    return tabeeError(fallback, error.message || fallback);
  }
  return tabeeError(fallback, typeof error === "string" ? error : fallback);
}

export function failedResult(error: unknown, fallback: TabeeErrorCode = "INTERNAL"): Result<never> {
  return { ok: false, error: asTabeeError(error, fallback) };
}
