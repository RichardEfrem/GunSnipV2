import { IsOptional, IsUUID } from 'class-validator';

/**
 * `GET /shipping/regions?parentId=` (FR-CO-03). No `parentId` lists the provinces.
 *
 * **No cursor**, which is a deliberate exception to CLAUDE.md's "every list endpoint is cursor-
 * paginated", made for the same reason `/categories` makes it: this is reference data, bounded by
 * the map of Indonesia, and its one consumer is a select that must show every option at once. A
 * cursor would be a loop the browser runs to rebuild the same list. The hard cap the rule exists
 * for is still there — `MAX_REGIONS_PER_PARENT` — set far above the largest real parent.
 */
export class ListRegionsDto {
  @IsOptional()
  @IsUUID()
  readonly parentId?: string;
}
