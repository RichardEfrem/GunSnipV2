import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { HealthModule } from '../health/health.module.js';

@Module({
  imports: [HealthModule],
  controllers: [AdminController],
})
export class AdminModule {}
