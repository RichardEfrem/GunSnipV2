import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NECESSITIES, type Necessity } from '@gunsnip/shared';

/**
 * `PUT /admin/products/:id/requirements` (FR-ADM-06) — the tools a kit needs (PRD §5.3).
 *
 * A `PUT` of the whole list rather than add/remove endpoints. The editor is a list the operator
 * arranges and saves, position matters, and sending the final arrangement makes the save
 * idempotent — the same reasoning as `ReorderDto`, applied to a list whose rows also carry data.
 */
export class RequirementLineDto {
  @IsUUID()
  readonly toolProductId!: string;

  @IsIn(NECESSITIES)
  readonly necessity!: Necessity;

  /** Why, in the customer's terms: "Waterslide decals need setting solution". */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  readonly reason?: string | null;
}

export class SetRequirementsDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RequirementLineDto)
  readonly requirements!: RequirementLineDto[];
}
