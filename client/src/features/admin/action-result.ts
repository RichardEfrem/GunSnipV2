import { ApiError } from '@/lib/api-error';

/**
 * What every admin Server Action returns.
 *
 * A discriminated result rather than a thrown error, because these are driven by `useActionState`
 * and a form has to render the failure beside the field the operator is looking at — a thrown
 * error becomes an error boundary, which loses everything they had typed.
 *
 * Genuinely unexpected failures still throw. This is for the ones the API is *telling* us about:
 * a duplicate SKU, a voucher below its minimum, a transition the state machine refuses. Those
 * are answers, not crashes.
 */
export type ActionResult =
  | { status: 'idle' }
  | { status: 'ok'; message?: string }
  | { status: 'error'; message: string; code?: string };

export const IDLE: ActionResult = { status: 'idle' };

/**
 * Runs an admin mutation and turns the API's error contract into a result a form can render.
 *
 * Only `ApiError` is caught — the single error shape the API produces (`DomainExceptionFilter`
 * on the server). Anything else is a bug in the web app rather than a message for the operator,
 * and is left to propagate.
 */
export async function toActionResult(work: () => Promise<unknown>, message?: string): Promise<ActionResult> {
  try {
    await work();
    return message === undefined ? { status: 'ok' } : { status: 'ok', message };
  } catch (error) {
    if (error instanceof ApiError) {
      return { status: 'error', message: error.message, code: error.code };
    }

    throw error;
  }
}
