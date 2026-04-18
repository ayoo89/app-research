import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseIntPipe, DefaultValuePipe, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/user.entity';
import { ProductService } from './product.service';
import { IsString, IsOptional, IsArray } from 'class-validator';

class CreateProductDto {
  @IsString() name: string;
  @IsOptional() @IsString() codeGold?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() subcategory?: string;
  @IsOptional() @IsString() family?: string;
  @IsOptional() @IsArray() images?: string[];
}

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductController {
  constructor(private productService: ProductService) {}

  @Get('distinct/:field')
  @ApiOperation({ summary: 'List distinct values for category, family, or subcategory' })
  getDistinct(@Param('field') field: string) {
    const allowed = ['category', 'family', 'subcategory'] as const;
    if (!(allowed as readonly string[]).includes(field)) {
      throw new BadRequestException('Field must be category, family, or subcategory');
    }
    return this.productService.getDistinctValues(field as 'category' | 'family' | 'subcategory');
  }

  @Get()
  @ApiOperation({ summary: 'List all products (paginated)' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const [data, total] = await this.productService.findAll(page, limit);
    return { data, total, page, limit };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<CreateProductDto>) {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  @Post(':id/trigger-embedding')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger embedding generation' })
  triggerEmbedding(@Param('id') id: string) {
    return this.productService.triggerEmbedding(id);
  }
}
