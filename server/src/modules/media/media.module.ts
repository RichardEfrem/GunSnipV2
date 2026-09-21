import { Module } from '@nestjs/common';
import { MediaStorage } from './media-storage.js';

/**
 * Uploaded images, for whichever context owns them.
 *
 * Its own module because two contexts need it — the catalogue (product photos, banners) and
 * reviews (customer photos) — and neither should reach into the other to get it (CLAUDE.md).
 * It knows how to compress, store and delete a file; which row the URL ends up on is the
 * caller's business.
 */
@Module({
  providers: [MediaStorage],
  exports: [MediaStorage],
})
export class MediaModule {}
