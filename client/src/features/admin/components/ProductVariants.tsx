'use client';

import { INVENTORY_MOVEMENT_REASONS } from '@gunsnip/shared';
import { Plus } from 'lucide-react';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatIdr } from '@/lib/formatters';
import { MOVEMENT_REASON_LABELS } from '@/lib/labels';
import { IDLE } from '../action-result';
import { adjustStockAction, createVariantAction, updateVariantAction } from '../actions';
import type { AdminProduct, AdminVariant } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminCheckbox, AdminFormGrid, AdminInput, AdminSelect } from './AdminField';
import { AdminPanel, AdminTable, Td, Th } from './AdminPanel';

/**
 * Variant management (FR-ADM-03) and stock adjustment (FR-ADM-05).
 *
 * The two sit together because that is where an operator looks for both, and they are kept
 * apart where it matters: editing a variant changes its price and its name, and the stock column
 * is not a field on that form. Moving stock is its own action with a mandatory reason, because
 * FR-ADM-05 requires every change to leave a row in `inventory_movement` explaining itself — and
 * a number an operator can type into a grid leaves nothing.
 */
export function ProductVariants({ product }: { product: AdminProduct }) {
  const [openPanel, setOpenPanel] = useState<{ kind: 'edit' | 'stock' | 'new'; variantId?: string } | null>(null);

  return (
    <AdminPanel
      title="Variants"
      description="Price and stock live here. Stock only moves with a reason."
      action={
        <Button
          variant="secondary"
          onClick={() => setOpenPanel(openPanel?.kind === 'new' ? null : { kind: 'new' })}
        >
          <Plus className="size-4" aria-hidden />
          Add variant
        </Button>
      }
      isFlush
    >
      {openPanel?.kind === 'new' ? (
        <div className="border-b border-armor-150 bg-armor-050 p-4">
          <NewVariantForm productId={product.id} onDone={() => setOpenPanel(null)} />
        </div>
      ) : null}

      {product.variants.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-frame-300">
          No variants yet. A product needs at least one before it can be published — there would be nothing to buy.
        </p>
      ) : (
        <AdminTable className="min-w-[44rem]">
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th className="text-right">Price</Th>
              <Th className="text-right">On hand</Th>
              <Th className="text-right">Reserved</Th>
              <Th className="text-right">Available</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => (
              <VariantRow
                key={variant.id}
                productId={product.id}
                variant={variant}
                openPanel={openPanel?.variantId === variant.id ? openPanel.kind : null}
                onOpen={(kind) =>
                  setOpenPanel(
                    openPanel?.variantId === variant.id && openPanel.kind === kind
                      ? null
                      : { kind, variantId: variant.id },
                  )
                }
              />
            ))}
          </tbody>
        </AdminTable>
      )}
    </AdminPanel>
  );
}

function VariantRow({
  productId,
  variant,
  openPanel,
  onOpen,
}: {
  productId: string;
  variant: AdminVariant;
  openPanel: 'edit' | 'stock' | 'new' | null;
  onOpen: (kind: 'edit' | 'stock') => void;
}) {
  return (
    <>
      <tr className={variant.isArchived ? 'opacity-60' : undefined}>
        <Td>
          <span className="font-mono text-xs">{variant.sku}</span>
          {variant.name === null ? null : <div className="mt-0.5 text-xs text-frame-300">{variant.name}</div>}
          {variant.isArchived ? <div className="mt-0.5 text-xs text-frame-300">Archived</div> : null}
        </Td>
        <Td className="whitespace-nowrap text-right font-mono tabular-nums">
          {formatIdr(variant.priceIdr)}
          {variant.compareAtPriceIdr === null ? null : (
            <div className="text-xs text-frame-300 line-through">{formatIdr(variant.compareAtPriceIdr)}</div>
          )}
        </Td>
        <Td className="text-right font-mono tabular-nums">{variant.stockOnHand}</Td>
        <Td className="text-right font-mono tabular-nums text-frame-300">{variant.stockReserved}</Td>
        <Td
          className={`text-right font-mono tabular-nums ${variant.availableQuantity === 0 ? 'text-danger' : ''}`}
        >
          {variant.availableQuantity}
        </Td>
        <Td className="whitespace-nowrap text-right">
          <button
            type="button"
            onClick={() => onOpen('edit')}
            aria-expanded={openPanel === 'edit'}
            className="reticle rounded-sm px-2 py-1 text-xs text-core-blue hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onOpen('stock')}
            aria-expanded={openPanel === 'stock'}
            className="reticle rounded-sm px-2 py-1 text-xs text-core-blue hover:underline"
          >
            Stock
          </button>
        </Td>
      </tr>

      {openPanel === null || openPanel === 'new' ? null : (
        <tr>
          <td colSpan={6} className="border-b border-armor-150 bg-armor-050 p-4">
            {openPanel === 'edit' ? (
              <EditVariantForm productId={productId} variant={variant} />
            ) : (
              <AdjustStockForm productId={productId} variant={variant} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function NewVariantForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const [result, formAction, isPending] = useActionState(createVariantAction.bind(null, productId), IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AdminFormGrid className="sm:grid-cols-3">
        <AdminInput label="SKU" name="sku" required minLength={3} maxLength={60} placeholder="MG-EXIA-01" />
        <AdminInput label="Name" name="name" isOptional maxLength={120} hint="Only shown when there is more than one." />
        <AdminInput label="Price (Rp)" name="priceIdr" type="number" min={0} required placeholder="785000" />
        <AdminInput
          label="Was (Rp)"
          name="compareAtPriceIdr"
          type="number"
          min={0}
          isOptional
          hint="Must be higher than the price."
        />
        <AdminInput
          label="Opening stock"
          name="openingStock"
          type="number"
          min={0}
          defaultValue={0}
          hint="Recorded as a received-stock movement."
        />
        <AdminInput label="Weight (g)" name="weightGrams" type="number" min={0} defaultValue={0} isOptional />
      </AdminFormGrid>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" isLoading={isPending}>
          Add variant
        </Button>
        {/* Stays open after a successful add so the operator can enter the next variant without
            reopening the panel — kits with five colourways are the common case. The table above
            has already re-rendered with the new row. */}
        <Button type="button" variant="ghost" onClick={onDone}>
          {result.status === 'ok' ? 'Done' : 'Cancel'}
        </Button>
        <ActionFeedback result={result} />
      </div>
    </form>
  );
}

function EditVariantForm({ productId, variant }: { productId: string; variant: AdminVariant }) {
  const [result, formAction, isPending] = useActionState(
    updateVariantAction.bind(null, productId, variant.id),
    IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AdminFormGrid className="sm:grid-cols-3">
        <AdminInput label="SKU" name="sku" defaultValue={variant.sku} required minLength={3} maxLength={60} />
        <AdminInput label="Name" name="name" defaultValue={variant.name ?? ''} isOptional maxLength={120} />
        <AdminInput label="Price (Rp)" name="priceIdr" type="number" min={0} defaultValue={variant.priceIdr} required />
        <AdminInput
          label="Was (Rp)"
          name="compareAtPriceIdr"
          type="number"
          min={0}
          defaultValue={variant.compareAtPriceIdr ?? ''}
          isOptional
        />
        <AdminInput label="Weight (g)" name="weightGrams" type="number" min={0} defaultValue={variant.weightGrams} />
        <AdminCheckbox
          label="Archived"
          name="isArchived"
          defaultChecked={variant.isArchived}
          hint="Hidden from the storefront. Past orders keep it."
          className="self-end pb-2"
        />
      </AdminFormGrid>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" isLoading={isPending}>
          Save variant
        </Button>
        <ActionFeedback result={result} />
      </div>
    </form>
  );
}

/**
 * FR-ADM-05: a signed delta and a mandatory reason.
 *
 * A delta rather than a new total, matching the API: two operators counting the same shelf
 * minutes apart both mean "add six", and sending totals would have the second silently undo the
 * first.
 */
function AdjustStockForm({ productId, variant }: { productId: string; variant: AdminVariant }) {
  const [result, formAction, isPending] = useActionState(
    adjustStockAction.bind(null, productId, variant.id),
    IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-xs text-frame-300">
        {variant.stockOnHand} on hand, {variant.stockReserved} reserved for placed orders — so{' '}
        {variant.stockOnHand - variant.stockReserved} can be removed.
      </p>

      <AdminFormGrid className="sm:grid-cols-3">
        <AdminInput
          label="Change by"
          name="delta"
          type="number"
          required
          placeholder="6"
          hint="Negative to remove. Zero is not a change."
        />

        <AdminSelect label="Reason" name="reason" required defaultValue="">
          <option value="" disabled>
            Choose a reason
          </option>
          {INVENTORY_MOVEMENT_REASONS.filter((reason) => reason !== 'ORDER_FULFILLED').map((reason) => (
            <option key={reason} value={reason}>
              {MOVEMENT_REASON_LABELS[reason]}
            </option>
          ))}
        </AdminSelect>

        <AdminInput label="Note" name="note" isOptional maxLength={500} placeholder="Pallet from Bandai" />
      </AdminFormGrid>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" isLoading={isPending}>
          Adjust stock
        </Button>
        <ActionFeedback result={result} />
      </div>
    </form>
  );
}
