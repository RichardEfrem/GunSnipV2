import { Module } from '@nestjs/common';
import { FallbackController } from './fallback.controller.js';

/**
 * Its own module purely for registration order: Nest registers the root module's own
 * controllers *before* those of the modules it imports, so a catch-all declared directly on
 * AppModule would shadow every feature route. Imported last, it is reached last.
 */
@Module({
  controllers: [FallbackController],
})
export class FallbackModule {}
