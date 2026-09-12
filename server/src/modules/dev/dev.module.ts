import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { DevPaymentsController } from './dev-payments.controller.js';

/**
 * Endpoints that exist to make Phase 0 testable without the systems Phase 1 brings — today, the
 * payment simulator (FR-PAY-05). Every route in this module carries `DevEndpointsGuard`, so an
 * endpoint added here cannot accidentally ship open.
 */
@Module({
  imports: [PaymentsModule],
  controllers: [DevPaymentsController],
})
export class DevModule {}
