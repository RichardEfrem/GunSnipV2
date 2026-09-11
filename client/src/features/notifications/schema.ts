import { z } from 'zod';

/** `POST /notify-requests` (FR-PDP-12). */
export const notifyRequestResultSchema = z.object({
  variantId: z.string(),
  isRegistered: z.boolean(),
});

export type NotifyRequestResult = z.infer<typeof notifyRequestResultSchema>;
