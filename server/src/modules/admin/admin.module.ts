import { Module } from '@nestjs/common';
import { HealthModule } from '../health/health.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [HealthModule, PaymentsModule],
  controllers: [AdminController],
})
export class AdminModule {}
