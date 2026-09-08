import { Injectable, Logger } from '@nestjs/common';
import { HealthRepository } from './health.repository.js';

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  database: 'up' | 'down';
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly repository: HealthRepository) {}

  async check(): Promise<HealthReport> {
    const database = await this.checkDatabase();

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      database,
    };
  }

  private async checkDatabase(): Promise<'up' | 'down'> {
    try {
      await this.repository.ping();
      return 'up';
    } catch (error) {
      this.logger.error({ msg: 'Database health check failed', err: error });
      return 'down';
    }
  }
}
