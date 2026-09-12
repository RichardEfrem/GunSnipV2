import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /admin/products/:id/images` (FR-ADM-04). Multipart: the file plus this body.
 *
 * `alt` is required and has a minimum length. DESIGN.md §6 asks for alt text that describes the
 * kit rather than saying "product image", and the only way to get that is to make it impossible
 * to skip — an optional field on an upload form is an empty field.
 */
export class UploadImageDto {
  @IsString()
  @MinLength(4)
  @MaxLength(300)
  readonly alt!: string;
}

/** `PATCH /admin/images/:imageId`. */
export class UpdateImageDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(300)
  readonly alt?: string;
}
