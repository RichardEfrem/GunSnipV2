'use client';

import { TicketPercent, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatIdr } from '@/lib/formatters';
import { useVoucher } from '../hooks/use-voucher';
import type { CartVoucher } from '../schema';
import { voucherRejectionText } from '../voucher-copy';

/**
 * Voucher entry, with inline validation and a specific reason when a code is refused
 * (FR-CART-06). One voucher per order (FR-PROMO-05), so the field is replaced by the applied
 * code rather than offering a second one beside it.
 *
 * A voucher that was applied and has since stopped qualifying stays visible, with the reason, in
 * `--warn` — it is a change to notice, not an error — and comes back by itself when the cart
 * qualifies again.
 */
export function VoucherForm({ voucher }: { voucher: CartVoucher | null }) {
  const { isPending, error, apply, remove, clearError } = useVoucher();
  const [code, setCode] = useState('');

  if (voucher !== null) {
    return (
      <div className="flex flex-col gap-2 border border-armor-150 bg-armor-050 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2">
            <TicketPercent className="size-4 shrink-0 text-core-blue" aria-hidden />
            <span className="font-mono text-sm">{voucher.code}</span>
            {voucher.isApplied ? (
              <span className="font-display text-sm font-semibold tabular-nums text-sortie-red">
                − {formatIdr(voucher.discountIdr)}
              </span>
            ) : null}
          </p>

          <Button variant="ghost" onClick={remove} isLoading={isPending} className="shrink-0 px-2 text-sm">
            Remove
            <span className="sr-only"> voucher {voucher.code}</span>
          </Button>
        </div>

        {voucher.rejection === null ? (
          voucher.description === null ? null : <p className="text-xs text-frame-300">{voucher.description}</p>
        ) : (
          <p className="flex items-start gap-1.5 text-xs text-warn">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            Not applied. {voucherRejectionText(voucher.code, voucher.rejection)}
          </p>
        )}

        {error === null ? null : (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(code);
  }

  return (
    <form onSubmit={submit} className="flex items-start gap-2" noValidate>
      <div className="flex-1">
        <Input
          label="Voucher code"
          name="voucher"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            // The reason belongs to the code that was refused; editing it makes it a new code.
            if (error !== null) clearError();
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          error={error ?? undefined}
          className="font-mono uppercase"
        />
      </div>

      {/* Aligned to the input rather than the label: 20px of label plus its gap. */}
      <Button type="submit" variant="secondary" isLoading={isPending} className="mt-6.5">
        Apply
      </Button>
    </form>
  );
}
