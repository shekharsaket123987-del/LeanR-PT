export type ActionResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail(message: string, code: string = "ERROR"): ActionResult<never> {
  return { success: false, error: { code, message } };
}

/** Runs a service call and normalizes both the success and thrown-error paths
 * into an ActionResult, so Server Actions never let a raw PostgrestError or
 * service-layer Error reach the client. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Unexpected error");
  }
}

/** Explicit type-guard, used instead of a raw `!result.success` check —
 * with this project's `strict: false` (strictNullChecks off), TS fails to
 * narrow a discriminated union returned through a generic type parameter, so
 * `result.error`/`result.data` don't narrow correctly without a guard like
 * this. Confirmed empirically; not fixable without flipping strict mode
 * project-wide (a separate, bigger decision — see ENGINEERING_STANDARDS.md §6). */
export function isFailure<T>(result: ActionResult<T>): result is { success: false; error: { code: string; message: string } } {
  return result.success === false;
}
