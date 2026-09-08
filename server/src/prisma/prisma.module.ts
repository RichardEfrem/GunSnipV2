import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/** Global so every module's repositories can inject PrismaService without re-importing. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
