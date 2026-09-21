import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /reviews/photos` (FR-REV-01). Multipart: the file plus this body.
 *
 * The invite token is required because this is the one upload a stranger can reach. Without it
 * the endpoint would be free image hosting for anyone who found it; with it, only someone holding
 * an unspent review link can put a file on the disk.
 */
export class UploadReviewPhotoDto {
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  readonly token!: string;
}
