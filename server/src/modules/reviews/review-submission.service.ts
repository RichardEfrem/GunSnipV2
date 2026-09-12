import { Injectable } from '@nestjs/common';
import { isUserActor, type Actor } from '@gunsnip/shared';
import type { SubmitReviewDto } from './dto/submit-review.dto.js';
import { ReviewInviteService } from './review-invite.service.js';
import { ReviewRepository } from './review.repository.js';

/**
 * Writing a review (FR-REV-01, FR-REV-02, FR-REV-03, FR-REV-04).
 *
 * The invite decides what is being reviewed — not the request body. A submission names a token
 * and nothing else about the product, so there is no field an author could change to review a
 * kit they never bought, and the verified badge is a fact the server established rather than a
 * claim the client made.
 *
 * Everything lands `PENDING`. Nothing a customer writes reaches the storefront, or the rating on
 * a product card, until a moderator approves it (FR-REV-06).
 */
@Injectable()
export class ReviewSubmissionService {
  constructor(
    private readonly invites: ReviewInviteService,
    private readonly reviews: ReviewRepository,
  ) {}

  async submit(actor: Actor, dto: SubmitReviewDto): Promise<{ id: string; status: 'PENDING' }> {
    const now = new Date();
    const invite = await this.invites.requireUsable(dto.token, now);

    // Non-null by `requireUsable`, which refuses an invite whose product has been deleted.
    const product = invite.orderItem.variant?.product;
    if (product === undefined) throw new Error('unreachable: usable invite without a product');

    const isKit = product.type === 'MODEL_KIT';

    const id = await this.reviews.createFromInvite(
      invite.id,
      {
        productId: product.id,
        orderItemId: invite.orderItem.id,
        // Both, from the first migration (PRD §11.1). Phase 1 fills the user id in without
        // moving a row or changing this call.
        sessionId: actor.sessionId,
        userId: isUserActor(actor) ? actor.userId : null,

        authorName: dto.authorName,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,

        // Dropped rather than rejected when the product is not a kit. A tool review that arrived
        // with a build time is a stale form or a hand-made request, and neither is worth a 400 —
        // but storing "this nipper took 14 hours to build" would put nonsense on a product page.
        buildTimeMinutes: isKit ? (dto.buildTimeMinutes ?? null) : null,
        experiencedDifficulty: isKit ? (dto.experiencedDifficulty ?? null) : null,
        toolsUsed: isKit ? (dto.toolsUsed ?? []) : [],

        photos: dto.photos ?? [],
      },
      now,
    );

    return { id, status: 'PENDING' };
  }
}
