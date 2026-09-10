import { Controller, Get } from '@nestjs/common';
import type { HomeContent } from './entities/home.entity.js';
import { HomeService } from './home.service.js';

@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  async content(): Promise<HomeContent> {
    return this.home.content();
  }
}
