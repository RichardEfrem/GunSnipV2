import { IsBoolean } from 'class-validator';

/** `PATCH /cart/items` — "Select all" and its inverse (DESIGN.md §3.6). */
export class SetCartSelectionDto {
  @IsBoolean()
  readonly isSelected!: boolean;
}
