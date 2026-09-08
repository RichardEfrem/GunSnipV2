import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** The only file in this module that touches Prisma (CLAUDE.md). */
@Injectable()
export class HealthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Round-trips a trivial query so the check fails when the pool is exhausted, not just when the host is down. */
  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
