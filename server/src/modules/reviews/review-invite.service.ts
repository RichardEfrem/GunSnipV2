import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { customerSnapshotSchema } from '../orders/entities/customer-snapshot.js';
import type { ReviewInviteView } from './entities/review-invite.entity.js';
import { ReviewInviteRepository, type ReviewInviteRow } from './review-invite.repository.js';
import { inviteExpiry, mintReviewToken } from './review-token.js';

/**
 * Review invites (FR-REV-02).
 *
 * Phase 0 has no accounts, so "only a buyer may review what they bought" has to be carried by
 * something the buyer holds. That something is a token, minted per delivered line when the order
 * is marked delivered and mailed to the address on the order. It is the whole of the
 * authorisation, which is why it is spent on use and why an expired one is refused rather than
 * quietly extended.
 *
 * Phase 1 adds a second way in — an account that owns the order — and it is additive: the review
 * service will take a resolved `ReviewAuthorisation` from either source.
 */
export interface IssuedInvite {
  productName: string;
  token: string;
}

@Injectable()
export class ReviewInviteService {
  constructor(private readonly invites: ReviewInviteRepository) {}

  /**
   * Mints one invite per reviewable line of a delivered order.
   *
   * Idempotent by construction: a line that already has an invite is not given another, so an
   * operator who marks an order delivered, reverts it and marks it again does not put two live
   * credentials for the same purchase into the world. Returns only what it minted, so the mail
   * that follows lists exactly the links that are new.
   */
  async issueForOrder(orderId: string, now: Date = new Date()): Promise<IssuedInvite[]> {
    const items = await this.invites.findInvitableItems(orderId);
    if (items.length === 0) return [];

    const expiresAt = inviteExpiry(now);
    const minted = items.map((item) => ({ ...item, token: mintReviewToken(), expiresAt }));

    await this.invites.issue(minted);

    return minted.map((invite) => ({ productName: invite.productName, token: invite.token }));
  }

  /**
   * What a link authorises, for rendering the form (`GET /reviews/invites/:token`).
   *
   * Every failure says the same kind of thing a customer can act on — the link is finished, or
   * it has run out — and none of them says whether some *other* token would have worked.
   */
  async resolve(token: string, now: Date = new Date()): Promise<ReviewInviteView> {
    return toInviteView(await this.require(token, now));
  }

  /**
   * The same checks, returning the row — for the submission path, which needs the ids rather
   * than the view. Kept here so "is this invite good?" has one answer.
   */
  async requireUsable(token: string, now: Date = new Date()): Promise<ReviewInviteRow> {
    return this.require(token, now);
  }

  private async require(token: string, now: Date): Promise<ReviewInviteRow> {
    const invite = await this.invites.findByToken(token);

    if (invite === null) {
      throw new NotFoundError('That review link is not one we issued.', { token });
    }

    if (invite.usedAt !== null) {
      throw new ConflictError('That review link has already been used — thank you for the review.', {
        token,
      });
    }

    if (invite.expiresAt <= now) {
      throw new ConflictError('That review link has expired.', {
        token,
        expiresAt: invite.expiresAt.toISOString(),
      });
    }

    if (invite.orderItem.variant === null) {
      throw new NotFoundError('That product is no longer in the catalogue.', { token });
    }

    return invite;
  }
}

function toInviteView(invite: ReviewInviteRow): ReviewInviteView {
  // Non-null by `require`, which refuses an invite whose product has gone.
  const product = invite.orderItem.variant?.product;
  if (product === undefined) throw new NotFoundError('That product is no longer in the catalogue.');

  const snapshot = customerSnapshotSchema.parse(invite.orderItem.order.customerSnapshot);

  return {
    token: invite.token,
    orderNumber: invite.orderItem.order.orderNumber,
    expiresAt: invite.expiresAt.toISOString(),
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.images[0]?.url ?? null,
    },
    isKit: product.type === 'MODEL_KIT',
    suggestedAuthorName: snapshot.name,
  };
}
