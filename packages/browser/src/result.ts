import {
  TabeeException,
  fail,
  isTabeeError,
  isPlainObject,
  type TabeeError,
  type Result,
} from "@tabee/protocol";

/**
 * Responses cross an untrusted boundary: the peer may return anything. Every
 * response is unwrapped as a tabEE `Result` and its payload re-validated.
 */
export function readRemoteResult<T>(
  value: unknown,
  validate: (payload: unknown) => Result<T>,
  context: string,
): Result<T> {
  if (!isPlainObject(value) || typeof value.ok !== "boolean") {
    return fail("INTERNAL", `${context}: malformed tabEE response`);
  }
  if (value.ok === false) {
    return isTabeeError(value.error)
      ? { ok: false, error: value.error }
      : fail("INTERNAL", `${context}: malformed tabEE error`);
  }
  return validate(value.value);
}

function penpalCode(error: unknown): string | undefined {
  if (error instanceof Error && "code" in error) {
    const code: unknown = error.code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/**
 * Maps transport failures onto tabEE codes. Penpal's codes are an
 * implementation detail and must never leak into the protocol surface.
 */
export function toTransportError(error: unknown, context: string): TabeeError {
  if (error instanceof TabeeException) return error.toJSON();
  if (isTabeeError(error)) return error;

  switch (penpalCode(error)) {
    case "CONNECTION_TIMEOUT":
    case "METHOD_CALL_TIMEOUT":
      return { code: "TIMED_OUT", message: `${context}: the remote side did not respond in time` };
    case "CONNECTION_DESTROYED":
      return { code: "CANCELLED", message: `${context}: the session was closed` };
    case "METHOD_NOT_FOUND":
      return {
        code: "HANDSHAKE_FAILED",
        message: `${context}: the remote side does not implement the tabEE method`,
      };
    default:
      return {
        code: "HANDSHAKE_FAILED",
        message: `${context}: ${error instanceof Error ? error.message : "connection failed"}`,
      };
  }
}

export function transportException(error: unknown, context: string): TabeeException {
  return new TabeeException(toTransportError(error, context));
}
