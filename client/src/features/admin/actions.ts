'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminApiFetch } from '@/lib/admin-api';
import { adminBannerListSchema, adminOrderSchema, adminProductSchema, adminReviewSchema, adminVoucherSchema, referenceItemSchema, stockLevelSchema } from './schema';
import { toActionResult, type ActionResult } from './action-result';
import { z } from 'zod';

/**
 * Every write the back office makes (FR-ADM-02 … FR-ADM-12).
 *
 * **Server Actions, not the api module.** CLAUDE.md says to pick one per feature and stay
 * consistent; admin picks actions for two reasons the storefront does not have. The admin key
 * lives in an httpOnly cookie that only server code can read, so a client-side mutation could
 * not authenticate at all — and every admin write invalidates a screen someone is looking at,
 * which `revalidatePath` handles and a plain fetch cannot.
 *
 * The API is still the only place the rules live. These actions marshal a `FormData` into the
 * shape a DTO expects and let the server refuse it; nothing here decides whether a voucher is
 * valid or a transition is legal.
 */

/** `''` means "left blank", which for a nullable column is `null` rather than an empty string. */
function text(form: FormData, field: string): string | undefined {
  const value = form.get(field);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/** A blank optional field clears the column; an absent one leaves it alone. */
function nullableText(form: FormData, field: string): string | null | undefined {
  if (!form.has(field)) return undefined;
  return text(form, field) ?? null;
}

function integer(form: FormData, field: string): number | undefined {
  const value = text(form, field);
  if (value === undefined) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function nullableInteger(form: FormData, field: string): number | null | undefined {
  if (!form.has(field)) return undefined;
  return text(form, field) === undefined ? null : integer(form, field);
}

function checkbox(form: FormData, field: string): boolean {
  return form.get(field) === 'on' || form.get(field) === 'true';
}

/** Comma- or newline-separated, which is how an operator types a list into a textarea. */
function list(form: FormData, field: string): string[] | undefined {
  const value = text(form, field);
  if (value === undefined) return form.has(field) ? [] : undefined;

  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

// -------------------------------------------------------------------------------- products

export async function createProductAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const type = form.get('type') === 'TOOL_SUPPLY' ? 'TOOL_SUPPLY' : 'MODEL_KIT';
  let created: { id: string } | undefined;

  const result = await toActionResult(async () => {
    created = await adminApiFetch('/admin/products', {
      method: 'POST',
      schema: adminProductSchema,
      body: {
        type,
        name: text(form, 'name'),
        slug: text(form, 'slug'),
        description: text(form, 'description') ?? null,
        brandId: text(form, 'brandId'),
        categoryId: text(form, 'categoryId'),
        tags: list(form, 'tags') ?? [],
        // Only the group that belongs to the chosen type. The API refuses the other one, which
        // is the rule — this just does not send something it knows is wrong.
        ...(type === 'MODEL_KIT'
          ? {
              kit: {
                gradeId: text(form, 'gradeId') ?? null,
                scaleId: text(form, 'scaleId') ?? null,
                seriesId: text(form, 'seriesId') ?? null,
                unitName: text(form, 'unitName') ?? null,
                unitCode: text(form, 'unitCode') ?? null,
              },
            }
          : { tool: { toolJob: text(form, 'toolJob') ?? null } }),
      },
    });
  });

  if (result.status !== 'ok' || created === undefined) return result;

  revalidatePath('/admin/products');
  // Straight into the editor: a product with no variants and no images cannot be published, so
  // creation is the first half of one task rather than a task of its own.
  redirect(`/admin/products/${created.id}`);
}

export async function updateProductAction(
  productId: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const isKit = form.get('productType') !== 'TOOL_SUPPLY';

  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/products/${productId}`, {
        method: 'PATCH',
        schema: adminProductSchema,
        body: {
          name: text(form, 'name'),
          description: nullableText(form, 'description'),
          brandId: text(form, 'brandId'),
          categoryId: text(form, 'categoryId'),
          tags: list(form, 'tags'),
          ...(isKit
            ? {
                kit: {
                  gradeId: nullableText(form, 'gradeId'),
                  scaleId: nullableText(form, 'scaleId'),
                  seriesId: nullableText(form, 'seriesId'),
                  unitName: nullableText(form, 'unitName'),
                  unitCode: nullableText(form, 'unitCode'),
                  runnerCount: nullableInteger(form, 'runnerCount'),
                  partCount: nullableInteger(form, 'partCount'),
                  difficulty: nullableText(form, 'difficulty'),
                  releaseYear: nullableInteger(form, 'releaseYear'),
                  runtimeMinutesEst: nullableInteger(form, 'runtimeMinutesEst'),
                  includes: list(form, 'includes'),
                },
              }
            : { tool: { toolJob: nullableText(form, 'toolJob') } }),
        },
      }),
    'Saved.',
  );

  revalidateProduct(productId);
  return result;
}

export async function setProductStatusAction(productId: string, status: string): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/products/${productId}/status`, {
        method: 'PUT',
        schema: adminProductSchema,
        body: { status },
      }),
    status === 'PUBLISHED' ? 'Published — it is live on the storefront.' : `Moved to ${status.toLowerCase()}.`,
  );

  revalidateProduct(productId);
  // The storefront listing and home page change the moment a product is published or withdrawn.
  revalidatePath('/', 'layout');

  return result;
}

// -------------------------------------------------------------------------------- variants

export async function createVariantAction(
  productId: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/products/${productId}/variants`, {
        method: 'POST',
        schema: adminProductSchema,
        body: {
          sku: text(form, 'sku')?.toUpperCase(),
          name: text(form, 'name') ?? null,
          priceIdr: integer(form, 'priceIdr'),
          compareAtPriceIdr: text(form, 'compareAtPriceIdr') === undefined ? null : integer(form, 'compareAtPriceIdr'),
          openingStock: integer(form, 'openingStock') ?? 0,
          weightGrams: integer(form, 'weightGrams') ?? 0,
        },
      }),
    'Variant added.',
  );

  revalidateProduct(productId);
  return result;
}

export async function updateVariantAction(
  productId: string,
  variantId: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/variants/${variantId}`, {
        method: 'PATCH',
        schema: adminProductSchema,
        body: {
          sku: text(form, 'sku')?.toUpperCase(),
          name: nullableText(form, 'name'),
          priceIdr: integer(form, 'priceIdr'),
          compareAtPriceIdr: nullableInteger(form, 'compareAtPriceIdr'),
          weightGrams: integer(form, 'weightGrams'),
          isArchived: checkbox(form, 'isArchived'),
        },
      }),
    'Variant saved.',
  );

  revalidateProduct(productId);
  return result;
}

/** FR-ADM-05. A reason is required, which is what makes `inventory_movement` readable. */
export async function adjustStockAction(
  productId: string,
  variantId: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/variants/${variantId}/stock`, {
        method: 'POST',
        schema: stockLevelSchema,
        body: {
          delta: integer(form, 'delta'),
          reason: text(form, 'reason'),
          note: text(form, 'note'),
        },
      }),
    'Stock adjusted.',
  );

  revalidateProduct(productId);
  return result;
}

// ---------------------------------------------------------------------------------- images

export async function uploadImageAction(
  productId: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const file = form.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Choose an image to upload.' };
  }

  const upload = new FormData();
  upload.set('file', file);
  upload.set('alt', text(form, 'alt') ?? '');

  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/products/${productId}/images`, {
        method: 'POST',
        schema: adminProductSchema,
        // Multipart: the body goes through untouched so the browser's own boundary survives.
        // `apiFetch` only sets `Content-Type` when it serialises JSON, which it does not here.
        body: upload,
      }),
    'Image uploaded.',
  );

  revalidateProduct(productId);
  return result;
}

export async function reorderImagesAction(productId: string, ids: string[]): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/products/${productId}/images/order`, {
        method: 'PUT',
        schema: adminProductSchema,
        body: { ids },
      }),
    'Order saved.',
  );

  revalidateProduct(productId);
  return result;
}

export async function setPrimaryImageAction(productId: string, imageId: string): Promise<ActionResult> {
  const result = await toActionResult(
    () => adminApiFetch(`/admin/images/${imageId}/primary`, { method: 'PUT', schema: adminProductSchema }),
    'Primary image set.',
  );

  revalidateProduct(productId);
  return result;
}

export async function deleteImageAction(productId: string, imageId: string): Promise<ActionResult> {
  const result = await toActionResult(
    () => adminApiFetch(`/admin/images/${imageId}`, { method: 'DELETE', schema: adminProductSchema }),
    'Image removed.',
  );

  revalidateProduct(productId);
  return result;
}

// --------------------------------------------------------------------- build requirements

export async function setRequirementsAction(
  productId: string,
  requirements: { toolProductId: string; necessity: string; reason: string | null }[],
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/products/${productId}/requirements`, {
        method: 'PUT',
        schema: adminProductSchema,
        body: { requirements },
      }),
    'Build requirements saved.',
  );

  revalidateProduct(productId);
  return result;
}

// ---------------------------------------------------------------------------------- orders

export async function advanceOrderAction(
  orderNumber: string,
  status: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/orders/${orderNumber}/status`, {
        method: 'POST',
        schema: adminOrderSchema,
        body: { status, note: text(form, 'note') },
      }),
    `Moved to ${status.toLowerCase().replace('_', ' ')}.`,
  );

  revalidateOrder(orderNumber);
  return result;
}

export async function settlePaymentAction(orderNumber: string, status: 'PAID' | 'FAILED'): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/orders/${orderNumber}/payment`, {
        method: 'POST',
        schema: z.object({ status: z.string() }),
        body: { status },
      }),
    status === 'PAID' ? 'Payment marked paid.' : 'Payment marked failed.',
  );

  revalidateOrder(orderNumber);
  return result;
}

export async function cancelOrderAction(
  orderNumber: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/orders/${orderNumber}/cancel`, {
        method: 'POST',
        schema: adminOrderSchema,
        body: { reason: text(form, 'reason') ?? '' },
      }),
    'Order cancelled and its stock released.',
  );

  revalidateOrder(orderNumber);
  return result;
}

export async function setShipmentAction(
  orderNumber: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/orders/${orderNumber}/shipment`, {
        method: 'PUT',
        schema: adminOrderSchema,
        body: { courier: text(form, 'courier'), trackingNumber: text(form, 'trackingNumber') ?? null },
      }),
    'Shipment saved.',
  );

  revalidateOrder(orderNumber);
  return result;
}

export async function setInternalNoteAction(
  orderNumber: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/orders/${orderNumber}/note`, {
        method: 'PUT',
        schema: adminOrderSchema,
        body: { internalNote: text(form, 'internalNote') ?? null },
      }),
    'Note saved.',
  );

  revalidateOrder(orderNumber);
  return result;
}

// -------------------------------------------------------------------------- reference data

/** The five tables share one action: the payload differs, the shape of the work does not. */
export async function createReferenceAction(
  table: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/reference/${table}`, {
        method: 'POST',
        schema: table === 'categories' ? z.object({ id: z.string() }) : referenceItemSchema,
        body:
          table === 'categories'
            ? {
                name: text(form, 'name'),
                type: text(form, 'type'),
                parentId: text(form, 'parentId') ?? null,
                position: integer(form, 'position') ?? 0,
              }
            : {
                ...(table === 'grades' || table === 'scales' ? { code: text(form, 'code') } : {}),
                name: text(form, 'name'),
                ...(table === 'grades' ? { description: text(form, 'description') ?? null } : {}),
                position: integer(form, 'position') ?? 0,
              },
      }),
    'Added.',
  );

  revalidatePath('/admin/reference');
  return result;
}

export async function updateReferenceAction(
  table: string,
  id: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/reference/${table}/${id}`, {
        method: 'PATCH',
        schema: table === 'categories' ? z.object({ id: z.string() }) : referenceItemSchema,
        body: {
          name: text(form, 'name'),
          ...(table === 'grades' ? { description: nullableText(form, 'description') } : {}),
          ...(table === 'brands' ? {} : { position: integer(form, 'position') }),
        },
      }),
    'Saved.',
  );

  revalidatePath('/admin/reference');
  return result;
}

export async function deleteReferenceAction(table: string, id: string): Promise<ActionResult> {
  const result = await toActionResult(
    () => adminApiFetch(`/admin/reference/${table}/${id}`, { method: 'DELETE', schema: z.undefined() }),
    'Removed.',
  );

  revalidatePath('/admin/reference');
  return result;
}

// -------------------------------------------------------------------------------- vouchers

function voucherBody(form: FormData): Record<string, unknown> {
  return {
    description: nullableText(form, 'description'),
    percentOff: nullableInteger(form, 'percentOff'),
    amountIdr: nullableInteger(form, 'amountIdr'),
    minSpendIdr: nullableInteger(form, 'minSpendIdr'),
    maxDiscountIdr: nullableInteger(form, 'maxDiscountIdr'),
    startsAt: toIso(text(form, 'startsAt')),
    endsAt: toIso(text(form, 'endsAt')),
    usageLimit: nullableInteger(form, 'usageLimit'),
    perSessionLimit: nullableInteger(form, 'perSessionLimit'),
    isActive: checkbox(form, 'isActive'),
  };
}

/**
 * A `datetime-local` input has no timezone, and the operator means Jakarta time — the store's
 * clock, which is what every other date in this system is displayed in (CLAUDE.md Conventions).
 * WIB is UTC+7 year round, so the offset is appended rather than letting the server guess.
 */
function toIso(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  return new Date(`${value}${value.length === 16 ? ':00' : ''}+07:00`).toISOString();
}

export async function createVoucherAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch('/admin/vouchers', {
        method: 'POST',
        schema: adminVoucherSchema,
        body: { code: text(form, 'code')?.toUpperCase(), type: text(form, 'type'), ...voucherBody(form) },
      }),
    'Voucher created.',
  );

  revalidatePath('/admin/vouchers');
  return result;
}

export async function updateVoucherAction(
  id: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () => adminApiFetch(`/admin/vouchers/${id}`, { method: 'PATCH', schema: adminVoucherSchema, body: voucherBody(form) }),
    'Voucher saved.',
  );

  revalidatePath('/admin/vouchers');
  return result;
}

export async function deleteVoucherAction(id: string): Promise<ActionResult> {
  const result = await toActionResult(
    () => adminApiFetch(`/admin/vouchers/${id}`, { method: 'DELETE', schema: z.undefined() }),
    'Voucher removed.',
  );

  revalidatePath('/admin/vouchers');
  return result;
}

// --------------------------------------------------------------------------------- reviews

export async function moderateReviewAction(id: string, status: 'APPROVED' | 'REJECTED'): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/reviews/${id}/moderation`, {
        method: 'POST',
        schema: adminReviewSchema,
        body: { status },
      }),
    status === 'APPROVED' ? 'Approved — it is live on the product page.' : 'Rejected.',
  );

  revalidatePath('/admin/reviews');
  revalidatePath('/admin');
  return result;
}

export async function replyToReviewAction(
  id: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () =>
      adminApiFetch(`/admin/reviews/${id}/reply`, {
        method: 'PUT',
        schema: adminReviewSchema,
        body: { adminReply: text(form, 'adminReply') ?? null },
      }),
    'Reply saved.',
  );

  revalidatePath('/admin/reviews');
  return result;
}

// --------------------------------------------------------------------------------- banners

function bannerBody(form: FormData): Record<string, unknown> {
  return {
    title: text(form, 'title'),
    subtitle: nullableText(form, 'subtitle'),
    imageUrl: text(form, 'imageUrl'),
    alt: text(form, 'alt'),
    href: text(form, 'href'),
    startsAt: text(form, 'startsAt') === undefined ? null : toIso(text(form, 'startsAt')),
    endsAt: text(form, 'endsAt') === undefined ? null : toIso(text(form, 'endsAt')),
    isActive: checkbox(form, 'isActive'),
  };
}

export async function createBannerAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const result = await toActionResult(
    () => adminApiFetch('/admin/banners', { method: 'POST', schema: z.object({ id: z.string() }), body: bannerBody(form) }),
    'Banner created.',
  );

  revalidateBanners();
  return result;
}

export async function updateBannerAction(
  id: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const result = await toActionResult(
    () => adminApiFetch(`/admin/banners/${id}`, { method: 'PATCH', schema: z.object({ id: z.string() }), body: bannerBody(form) }),
    'Banner saved.',
  );

  revalidateBanners();
  return result;
}

export async function reorderBannersAction(ids: string[]): Promise<ActionResult> {
  const result = await toActionResult(
    () => adminApiFetch('/admin/banners/order', { method: 'PUT', schema: adminBannerListSchema, body: { ids } }),
    'Order saved.',
  );

  revalidateBanners();
  return result;
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  const result = await toActionResult(
    () => adminApiFetch(`/admin/banners/${id}`, { method: 'DELETE', schema: z.undefined() }),
    'Banner removed.',
  );

  revalidateBanners();
  return result;
}

/**
 * A product edit changes three places: its editor, the admin list, and — once it is published —
 * whatever the storefront is caching of it.
 */
function revalidateProduct(productId: string): void {
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/admin/products');
  revalidatePath('/admin');
}

function revalidateOrder(orderNumber: string): void {
  revalidatePath(`/admin/orders/${orderNumber}`);
  revalidatePath('/admin/orders');
  revalidatePath('/admin');
}

/** Banners are home-page chrome, so the storefront's home page goes with them. */
function revalidateBanners(): void {
  revalidatePath('/admin/banners');
  revalidatePath('/');
}
