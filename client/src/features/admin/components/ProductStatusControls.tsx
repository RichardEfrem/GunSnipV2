'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { formatDate, formatIdr } from '@/lib/formatters';
import { IDLE, type ActionResult } from '../action-result';
import { setProductStatusAction } from '../actions';
import type { AdminProduct } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminPanel } from './AdminPanel';
import { ProductStatusBadge } from './OrderStatusBadge';

/**
 * Publishing (FR-ADM-02), and the numbers that say whether it is ready.
 *
 * The readiness checks are shown *before* the operator presses the button, not only after the
 * API refuses. The API is still the authority — it refuses a publish with no sellable variant
 * or no image — but a form that only tells you what is wrong once you have tried is a form that
 * wastes a round trip to say something it already knew.
 */
export function ProductStatusControls({ product }: { product: AdminProduct }) {
  const [result, setResult] = useState<ActionResult>(IDLE);
  const [isPending, startTransition] = useTransition();

  const sellableVariants = product.variants.filter((variant) => !variant.isArchived);
  const blockers = [
    sellableVariants.length === 0 ? 'Add at least one variant that is not archived.' : null,
    product.images.length === 0 ? 'Add at least one image.' : null,
  ].filter((blocker): blocker is string => blocker !== null);

  function setStatus(status: string): void {
    startTransition(async () => {
      setResult(await setProductStatusAction(product.id, status));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminPanel title="Status">
        <div className="mb-3 flex items-center gap-2">
          <ProductStatusBadge status={product.status} />
          {product.publishedAt === null ? (
            <span className="text-xs text-frame-300">Never published</span>
          ) : (
            <span className="text-xs text-frame-300">First published {formatDate(product.publishedAt)}</span>
          )}
        </div>

        {product.status === 'PUBLISHED' ? (
          <>
            <Link
              href={`/products/${product.slug}`}
              className="reticle mb-3 inline-flex items-center gap-1.5 rounded-sm text-sm text-core-blue hover:underline"
            >
              View on the storefront
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>

            <div className="flex flex-col gap-2">
              <Button variant="secondary" isLoading={isPending} onClick={() => setStatus('DRAFT')}>
                Return to draft
              </Button>
              <Button variant="danger" isLoading={isPending} onClick={() => setStatus('ARCHIVED')}>
                Archive
              </Button>
            </div>
          </>
        ) : (
          <>
            {blockers.length > 0 ? (
              <div className="mb-3 rounded-sm bg-armor-050 p-3">
                <p className="mb-1.5 text-xs font-medium">Before it can go live:</p>
                <ul className="list-inside list-disc text-xs text-frame-300">
                  {blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                isLoading={isPending}
                disabled={blockers.length > 0}
                disabledReason={blockers[0]}
                onClick={() => setStatus('PUBLISHED')}
              >
                Publish
              </Button>

              {product.status === 'ARCHIVED' ? (
                <Button variant="secondary" isLoading={isPending} onClick={() => setStatus('DRAFT')}>
                  Return to draft
                </Button>
              ) : (
                <Button variant="danger" isLoading={isPending} onClick={() => setStatus('ARCHIVED')}>
                  Archive
                </Button>
              )}
            </div>
          </>
        )}

        <ActionFeedback result={result} className="mt-3" />
      </AdminPanel>

      <AdminPanel title="At a glance">
        <dl className="flex flex-col gap-2 text-sm">
          <Row term="Price range">
            {product.minPriceIdr === 0 && product.maxPriceIdr === 0
              ? '—'
              : product.minPriceIdr === product.maxPriceIdr
                ? formatIdr(product.minPriceIdr)
                : `${formatIdr(product.minPriceIdr)} – ${formatIdr(product.maxPriceIdr)}`}
          </Row>
          <Row term="Sellable variants">{String(sellableVariants.length)}</Row>
          <Row term="Units sold">{String(product.unitsSold)}</Row>
          <Row term="Approved reviews">{String(product.reviewCount)}</Row>
          <Row term="Last edited">{formatDate(product.updatedAt)}</Row>
        </dl>
      </AdminPanel>
    </div>
  );
}

function Row({ term, children }: { term: string; children: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-frame-300">{term}</dt>
      <dd className="font-mono text-xs tabular-nums">{children}</dd>
    </div>
  );
}
