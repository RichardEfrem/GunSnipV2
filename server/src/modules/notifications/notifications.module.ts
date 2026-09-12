import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { MailerModule } from './mailer/mailer.module.js';
import { NotifyRequestRepository } from './notify-request.repository.js';
import { NotifyRequestService } from './notify-request.service.js';
import { NotifyRequestsController } from './notify-requests.controller.js';
import { OrderMailRepository } from './order-mail.repository.js';
import { OrderMailService } from './order-mail.service.js';

/**
 * Outbound interest and messaging.
 *
 * Phase 5 captured back-in-stock interest from out-of-stock product pages (FR-PDP-12). Phase 10
 * adds the `Mailer` seam and the four transactional order mails (FR-NOTIF-01, FR-NOTIF-02).
 *
 * It imports `ReviewsModule` because the delivery mail is what carries the review links, and the
 * invite has to be minted to write them (FR-REV-02). One direction only: reviews knows nothing
 * about mail, so there is no cycle to break.
 */
@Module({
  imports: [MailerModule, ReviewsModule],
  controllers: [NotifyRequestsController],
  providers: [NotifyRequestService, NotifyRequestRepository, OrderMailRepository, OrderMailService],
  exports: [OrderMailService],
})
export class NotificationsModule {}
