import { Controller, Get, Param } from '@nestjs/common';
import { CategoryService } from './category.service.js';
import type { CategoryDetail, CategoryNode } from './entities/category.entity.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  async tree(): Promise<CategoryNode[]> {
    return this.categories.tree();
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string): Promise<CategoryDetail> {
    return this.categories.detail(slug);
  }
}
