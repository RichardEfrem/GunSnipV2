import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/**
 * Reordering, for images (FR-ADM-04) and anything else that carries a `position`.
 *
 * The whole list of ids in their new order, not a pair of "move from, move to" indexes. A drag
 * produces a final arrangement and sending that arrangement is idempotent: replaying the request
 * lands in the same place, whereas replaying a relative move does not.
 */
export class ReorderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  readonly ids!: string[];
}
