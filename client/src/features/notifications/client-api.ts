import { apiFetch } from '@/lib/api-client';
import { notifyRequestResultSchema, type NotifyRequestResult } from './schema';

/**
 * Back-in-stock capture (FR-PDP-12). Browser-side: it is a form on an otherwise static page,
 * and a Server Action would make the whole product page dynamic to serve one input.
 */
export async function registerNotifyRequest(
  variantId: string,
  email: string,
): Promise<NotifyRequestResult> {
  return apiFetch('/notify-requests', {
    schema: notifyRequestResultSchema,
    method: 'POST',
    body: { variantId, email },
  });
}
