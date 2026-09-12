import { Controller, Get, Param } from '@nestjs/common';
import { BundleService } from './bundle.service.js';
import type { BundleSummary } from './entities/bundle.entity.js';

/** Curated bundles (FR-CAT-11). A short, operator-curated list — no filters, no pagination. */
@Controller('bundles')
export class BundlesController {
  constructor(private readonly bundles: BundleService) {}

  @Get()
  async list(): Promise<BundleSummary[]> {
    return this.bundles.list();
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string): Promise<BundleSummary> {
    return this.bundles.detail(slug);
  }
}
