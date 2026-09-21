import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchReviewInvite } from '@/features/reviews/api';
import { ReviewForm } from '@/features/reviews/components/ReviewForm';
import type { ReviewInvite } from '@/features/reviews/schema';
import { isVectorImage } from '@/lib/image';

/**
 * Writing a review from the link in the delivery email (FR-REV-02).
 *
 * In Phase 0 this page *is* the authorisation: there are no accounts, so the token in the URL is
 * what proves the visitor bought the thing. The invite is resolved on the server before anything
 * renders, so an expired or spent link never shows a form that could not have worked.
 *
 * Never indexed. The URL contains a credential, and a crawler following one out of a leaked
 * mailbox would be the one visitor guaranteed not to be the customer.
 */
export const metadata: Metadata = {
  title: 'Write a review',
  robots: { index: false, follow: false },
};

export default async function ReviewInvitePage({ params }: PageProps<'/review/[token]'>) {
  const { token } = await params;

  let invite: ReviewInvite;

  try {
    invite = await fetchReviewInvite(token);
  } catch {
    // Every failure reads the same to the visitor on purpose: whether a link was never issued,
    // already used or has expired, the answer is the same and none of them should confirm which
    // other tokens exist.
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
        <EmptyState
          title="This review link is no longer usable"
          description="It may already have been used, or it has expired. Links are good for 90 days after delivery."
          action={
            <Link href="/" className="reticle rounded-sm text-sm font-medium text-core-blue">
              Back to the shop
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 md:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-xs text-frame-300">Order {invite.orderNumber}</p>
        <h1 className="font-display text-2xl font-semibold leading-tight">How was it?</h1>

        <div className="flex items-center gap-3 border border-armor-150 bg-armor-050 p-3">
          {invite.product.imageUrl === null ? null : (
            <Image
              src={invite.product.imageUrl}
              alt=""
              width={64}
              height={64}
              unoptimized={isVectorImage(invite.product.imageUrl)}
              className="size-16 shrink-0 rounded-sm object-cover"
            />
          )}
          <Link
            href={`/products/${invite.product.slug}`}
            className="reticle rounded-sm font-display font-semibold hover:text-core-blue"
          >
            {invite.product.name}
          </Link>
        </div>
      </header>

      <ReviewForm invite={invite} />
    </div>
  );
}
