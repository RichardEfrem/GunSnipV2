import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { ValidationError } from '../../common/errors/validation.error.js';
import { toAdminProduct } from './admin-product-mapper.js';
import type { SetRequirementsDto } from './dto/write-requirement.dto.js';
import type { AdminProduct } from './entities/admin-product.entity.js';
import { ProductWriteRepository } from './product-write.repository.js';

/**
 * The build-requirement editor (FR-ADM-06) — which tools a kit needs (PRD §5.3).
 *
 * This list is what the customer-facing "What you'll need to build this" block renders
 * (FR-PDP-08) and what its one-click "Add selected" acts on, so the rules here are about keeping
 * that block honest: a requirement names a tool, a kit does not require itself, and the same
 * tool is not listed twice.
 */
@Injectable()
export class RequirementAdminService {
  constructor(private readonly products: ProductWriteRepository) {}

  async set(kitProductId: string, dto: SetRequirementsDto): Promise<AdminProduct> {
    const kit = await this.products.findById(kitProductId);
    if (kit === null) throw new NotFoundError('No product with that id.', { productId: kitProductId });

    if (kit.type !== 'MODEL_KIT') {
      throw new ConflictError('Only a model kit has build requirements.', { type: kit.type });
    }

    const toolIds = dto.requirements.map((line) => line.toolProductId);

    if (new Set(toolIds).size !== toolIds.length) {
      throw new ValidationError('The same tool is listed more than once.', { toolIds });
    }

    if (toolIds.includes(kitProductId)) {
      throw new ValidationError('A kit cannot require itself.', { productId: kitProductId });
    }

    // One query for the whole list: every id has to name a product of type TOOL_SUPPLY, or the
    // PDP block would offer someone a kit as a tool they need to build their kit.
    const tools = await this.products.publishedToolIds(toolIds);
    const notTools = toolIds.filter((id) => !tools.has(id));

    if (notTools.length > 0) {
      throw new ValidationError('A build requirement has to name a tool or supply.', { notTools });
    }

    return toAdminProduct(
      await this.products.setRequirements(
        kitProductId,
        dto.requirements.map((line) => ({
          toolProductId: line.toolProductId,
          necessity: line.necessity,
          reason: line.reason ?? null,
        })),
      ),
    );
  }
}
