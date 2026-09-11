import { Module } from '@nestjs/common';
import { NotifyRequestRepository } from './notify-request.repository.js';
import { NotifyRequestService } from './notify-request.service.js';
import { NotifyRequestsController } from './notify-requests.controller.js';

/**
 * Outbound interest and messaging.
 *
 * Phase 5 needs only the back-in-stock capture an out-of-stock product page offers
 * (FR-PDP-12). The `Mailer` seam and the transactional emails land here in Phase 10.
 */
@Module({
  controllers: [NotifyRequestsController],
  providers: [NotifyRequestService, NotifyRequestRepository],
})
export class NotificationsModule {}
