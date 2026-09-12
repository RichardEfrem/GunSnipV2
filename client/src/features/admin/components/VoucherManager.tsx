'use client';

import { VOUCHER_TYPES, type VoucherType } from '@gunsnip/shared';
import { Plus, Trash2 } from 'lucide-react';
import { Fragment, useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { formatDate, formatIdr } from '@/lib/formatters';
import { VOUCHER_TYPE_LABELS } from '@/lib/labels';
import { IDLE, type ActionResult } from '../action-result';
import { createVoucherAction, deleteVoucherAction, updateVoucherAction } from '../actions';
import type { AdminVoucher } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminCheckbox, AdminFormGrid, AdminInput, AdminSelect } from './AdminField';
import { AdminPanel, AdminTable, Td, Th } from './AdminPanel';

/**
 * Voucher CRUD (FR-ADM-10).
 *
 * The value fields shown depend on the type, the same rule the API enforces: a percentage
 * voucher takes a percentage and a fixed-amount one takes rupiah, and offering both would let an
 * operator fill in a field that is about to be rejected. Free shipping takes neither — its
 * optional `amountIdr` is a *cap* on the shipping waived, so it is labelled as one.
 *
 * `usedCount` is displayed and never editable. It is a counter the order transaction owns, and a
 * field for it would be a way to hand out a used-up voucher again.
 */
export function VoucherManager({ vouchers, className }: { vouchers: AdminVoucher[]; className?: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<ActionResult>(IDLE);
  const [isDeleting, startDelete] = useTransition();

  return (
    <AdminPanel
      className={className}
      title="Vouchers"
      action={
        <Button variant="secondary" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="size-4" aria-hidden />
          New voucher
        </Button>
      }
      isFlush
    >
      {isAdding ? (
        <div className="border-b border-armor-150 bg-armor-050 p-4">
          <VoucherForm onDone={() => setIsAdding(false)} />
        </div>
      ) : null}

      {deleteResult.status === 'error' ? (
        <div className="border-b border-armor-150 bg-armor-050 px-4 py-3">
          <ActionFeedback result={deleteResult} />
        </div>
      ) : null}

      {vouchers.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-frame-300">
          No vouchers match. Clear the filters, or create one.
        </p>
      ) : (
        <AdminTable className="min-w-[46rem]">
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Takes off</Th>
              <Th>Window</Th>
              <Th className="text-right">Used</Th>
              <Th>On</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((voucher) => (
              <Fragment key={voucher.id}>
                <tr>
                  <Td>
                    <span className="font-mono text-xs font-semibold">{voucher.code}</span>
                    <div className="mt-0.5 text-xs text-frame-300">{VOUCHER_TYPE_LABELS[voucher.type]}</div>
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{describeValue(voucher)}</Td>
                  <Td className="whitespace-nowrap text-xs text-frame-300">
                    {formatDate(voucher.startsAt)} → {formatDate(voucher.endsAt)}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {voucher.usedCount}
                    {voucher.usageLimit === null ? '' : ` / ${voucher.usageLimit}`}
                  </Td>
                  <Td className="text-xs">{voucher.isActive ? 'Yes' : 'No'}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === voucher.id ? null : voucher.id)}
                      aria-expanded={editingId === voucher.id}
                      className="reticle rounded-sm px-2 py-1 text-xs text-core-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      title={
                        voucher.redemptionCount > 0
                          ? 'Redeemed on an order — switch it off instead'
                          : `Remove ${voucher.code}`
                      }
                      disabled={voucher.redemptionCount > 0 || isDeleting}
                      onClick={() =>
                        startDelete(async () => setDeleteResult(await deleteVoucherAction(voucher.id)))
                      }
                      className="reticle rounded-sm p-1.5 text-danger hover:bg-danger-tint disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">Remove {voucher.code}</span>
                    </button>
                  </Td>
                </tr>

                {editingId === voucher.id ? (
                  <tr>
                    <td colSpan={6} className="border-b border-armor-150 bg-armor-050 p-4">
                      <VoucherForm voucher={voucher} onDone={() => setEditingId(null)} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </AdminTable>
      )}
    </AdminPanel>
  );
}

/** `15% off, up to Rp 100.000` · `Rp 50.000 off` · `Free shipping`. */
function describeValue(voucher: AdminVoucher): string {
  if (voucher.type === 'PERCENTAGE') {
    const cap = voucher.maxDiscountIdr === null ? '' : `, up to ${formatIdr(voucher.maxDiscountIdr)}`;
    return `${voucher.percentOff ?? 0}% off${cap}`;
  }

  if (voucher.type === 'FIXED_AMOUNT') return `${formatIdr(voucher.amountIdr ?? 0)} off`;

  return voucher.amountIdr === null ? 'Free shipping' : `Free shipping, up to ${formatIdr(voucher.amountIdr)}`;
}

/** `datetime-local` wants `yyyy-mm-ddThh:mm` in the operator's timezone — Jakarta, UTC+7. */
function toLocalInput(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function VoucherForm({ voucher, onDone }: { voucher?: AdminVoucher; onDone: () => void }) {
  const isNew = voucher === undefined;
  const [result, formAction, isPending] = useActionState(
    isNew ? createVoucherAction : updateVoucherAction.bind(null, voucher.id),
    IDLE,
  );
  const [type, setType] = useState<VoucherType>(voucher?.type ?? 'PERCENTAGE');

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AdminFormGrid className="sm:grid-cols-3">
        {isNew ? (
          <>
            <AdminInput
              label="Code"
              name="code"
              required
              minLength={3}
              maxLength={32}
              placeholder="WELCOME15"
              hint="Uppercase. Never changes."
            />
            <AdminSelect
              label="Type"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as VoucherType)}
              hint="Cannot be changed later."
            >
              {VOUCHER_TYPES.map((option) => (
                <option key={option} value={option}>
                  {VOUCHER_TYPE_LABELS[option]}
                </option>
              ))}
            </AdminSelect>
          </>
        ) : null}

        {type === 'PERCENTAGE' ? (
          <AdminInput
            label="Percent off"
            name="percentOff"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={voucher?.percentOff ?? ''}
          />
        ) : null}

        {type === 'FIXED_AMOUNT' ? (
          <AdminInput
            label="Amount off (Rp)"
            name="amountIdr"
            type="number"
            min={0}
            required
            defaultValue={voucher?.amountIdr ?? ''}
          />
        ) : null}

        {type === 'FREE_SHIPPING' ? (
          <AdminInput
            label="Shipping cap (Rp)"
            name="amountIdr"
            type="number"
            min={0}
            isOptional
            defaultValue={voucher?.amountIdr ?? ''}
            hint="The most shipping it will waive. Blank waives all of it."
          />
        ) : null}

        {type === 'PERCENTAGE' ? (
          <AdminInput
            label="Maximum discount (Rp)"
            name="maxDiscountIdr"
            type="number"
            min={0}
            isOptional
            defaultValue={voucher?.maxDiscountIdr ?? ''}
          />
        ) : null}

        <AdminInput
          label="Minimum spend (Rp)"
          name="minSpendIdr"
          type="number"
          min={0}
          isOptional
          defaultValue={voucher?.minSpendIdr ?? ''}
        />

        <AdminInput
          label="Starts"
          name="startsAt"
          type="datetime-local"
          required
          defaultValue={voucher === undefined ? '' : toLocalInput(voucher.startsAt)}
          hint="Jakarta time."
        />
        <AdminInput
          label="Ends"
          name="endsAt"
          type="datetime-local"
          required
          defaultValue={voucher === undefined ? '' : toLocalInput(voucher.endsAt)}
        />

        <AdminInput
          label="Total uses"
          name="usageLimit"
          type="number"
          min={1}
          isOptional
          defaultValue={voucher?.usageLimit ?? ''}
          hint="Blank is unlimited."
        />
        <AdminInput
          label="Uses per customer"
          name="perSessionLimit"
          type="number"
          min={1}
          isOptional
          defaultValue={voucher?.perSessionLimit ?? ''}
        />

        <AdminInput
          label="Description"
          name="description"
          isOptional
          maxLength={300}
          defaultValue={voucher?.description ?? ''}
          className="sm:col-span-2"
        />

        <AdminCheckbox
          label="Switched on"
          name="isActive"
          defaultChecked={voucher?.isActive ?? true}
          className="self-end pb-2"
        />
      </AdminFormGrid>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" isLoading={isPending}>
          {isNew ? 'Create voucher' : 'Save voucher'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Done
        </Button>
        <ActionFeedback result={result} />
      </div>
    </form>
  );
}
