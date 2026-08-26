/** Structured context attached to a reported error. */
export type ErrorContext = Record<string, string | number | boolean | null | undefined>;

/**
 * Single choke point for errors that are swallowed before reaching the UI.
 *
 * Callers that deliberately show the user a generic message (contract
 * simulation failures, RPC errors) must send the real cause here so it isn't
 * lost. This repo has no error-reporting backend wired up yet, so for now the
 * cause goes to the console.
 *
 * ponytail: everything funnels through this one function, so adding Sentry (or
 * any other backend) later means editing this body and nothing else.
 */
export function reportError(error: unknown, context?: ErrorContext): void {
  console.error("[stellarview]", context ?? {}, error);
}
