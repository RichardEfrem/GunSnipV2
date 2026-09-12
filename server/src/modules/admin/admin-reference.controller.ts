import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import { ReferenceAdminService } from '../catalog/reference-admin.service.js';
import {
  CreateCategoryDto,
  CreateGradeDto,
  CreateNamedDto,
  CreateScaleDto,
  UpdateCategoryDto,
  UpdateGradeDto,
  UpdateNamedDto,
  UpdateScaleDto,
} from '../catalog/dto/write-reference.dto.js';
import type { AdminCategory, AdminReferenceItem } from '../catalog/entities/admin-reference.entity.js';
import { IdParamDto } from './dto/id-param.dto.js';

/**
 * Reference-data management (FR-ADM-09) — the five tables the filter rail is built from.
 *
 * Five near-identical route groups in one controller rather than five controllers. They are one
 * screen to the operator and one bounded context to the code; splitting them would be five files
 * whose only difference is a noun.
 */
@Controller('admin/reference')
@UseGuards(AdminGuard)
export class AdminReferenceController {
  constructor(private readonly reference: ReferenceAdminService) {}

  @Get('grades')
  async grades(): Promise<AdminReferenceItem[]> {
    return this.reference.grades();
  }

  @Post('grades')
  async createGrade(@Body() dto: CreateGradeDto): Promise<AdminReferenceItem> {
    return this.reference.createGrade(dto);
  }

  @Patch('grades/:id')
  async updateGrade(@Param() params: IdParamDto, @Body() dto: UpdateGradeDto): Promise<AdminReferenceItem> {
    return this.reference.updateGrade(params.id, dto);
  }

  @Delete('grades/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGrade(@Param() params: IdParamDto): Promise<void> {
    await this.reference.deleteGrade(params.id);
  }

  @Get('scales')
  async scales(): Promise<AdminReferenceItem[]> {
    return this.reference.scales();
  }

  @Post('scales')
  async createScale(@Body() dto: CreateScaleDto): Promise<AdminReferenceItem> {
    return this.reference.createScale(dto);
  }

  @Patch('scales/:id')
  async updateScale(@Param() params: IdParamDto, @Body() dto: UpdateScaleDto): Promise<AdminReferenceItem> {
    return this.reference.updateScale(params.id, dto);
  }

  @Delete('scales/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteScale(@Param() params: IdParamDto): Promise<void> {
    await this.reference.deleteScale(params.id);
  }

  @Get('series')
  async series(): Promise<AdminReferenceItem[]> {
    return this.reference.series();
  }

  @Post('series')
  async createSeries(@Body() dto: CreateNamedDto): Promise<AdminReferenceItem> {
    return this.reference.createSeries(dto);
  }

  @Patch('series/:id')
  async updateSeries(@Param() params: IdParamDto, @Body() dto: UpdateNamedDto): Promise<AdminReferenceItem> {
    return this.reference.updateSeries(params.id, dto);
  }

  @Delete('series/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSeries(@Param() params: IdParamDto): Promise<void> {
    await this.reference.deleteSeries(params.id);
  }

  @Get('brands')
  async brands(): Promise<AdminReferenceItem[]> {
    return this.reference.brands();
  }

  @Post('brands')
  async createBrand(@Body() dto: CreateNamedDto): Promise<AdminReferenceItem> {
    return this.reference.createBrand(dto);
  }

  @Patch('brands/:id')
  async updateBrand(@Param() params: IdParamDto, @Body() dto: UpdateNamedDto): Promise<AdminReferenceItem> {
    return this.reference.updateBrand(params.id, dto);
  }

  @Delete('brands/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBrand(@Param() params: IdParamDto): Promise<void> {
    await this.reference.deleteBrand(params.id);
  }

  @Get('categories')
  async categories(): Promise<AdminCategory[]> {
    return this.reference.categories();
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto): Promise<AdminCategory> {
    return this.reference.createCategory(dto);
  }

  @Patch('categories/:id')
  async updateCategory(@Param() params: IdParamDto, @Body() dto: UpdateCategoryDto): Promise<AdminCategory> {
    return this.reference.updateCategory(params.id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param() params: IdParamDto): Promise<void> {
    await this.reference.deleteCategory(params.id);
  }
}
