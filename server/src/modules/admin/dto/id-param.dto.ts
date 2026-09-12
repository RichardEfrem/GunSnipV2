import { IsUUID } from 'class-validator';

/**
 * The `:id` in an admin route.
 *
 * A class rather than `@Param('id')`, so the value is validated as a UUID before it reaches a
 * service. Without it a malformed id becomes a Prisma error about an invalid input syntax —
 * a 500 for what is plainly a bad request.
 */
export class IdParamDto {
  @IsUUID()
  id!: string;
}

/** The same, for routes whose parameter names what it addresses rather than a bare `id`. */
export class VariantIdParamDto {
  @IsUUID()
  variantId!: string;
}

export class ImageIdParamDto {
  @IsUUID()
  imageId!: string;
}
