import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseIntPipe, DefaultValuePipe, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/user.entity';
import { ProductService } from './product.service';
import { IsString, IsOptional, IsArray } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

class CreateProductDto {
  @IsString() name: string;
  @IsOptional() @IsString() codeGold?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() subcategory?: string;
  @IsOptional() @IsString() family?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsArray() images?: string[];
}

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductController {
  constructor(
    private productService: ProductService,
    private config: ConfigService,
  ) {}

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
  @ApiOperation({ summary: 'List all products (paginated, filterable)' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('family') family?: string,
    @Query('subcategory') subcategory?: string,
    @Query('category') category?: string,
  ) {
    const [data, total] = await this.productService.findAll(page, limit, search, family, subcategory, category);
    return { data, total, page, limit };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const product = await this.productService.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
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

  @Post(':id/image')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload image for a product' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Image file required');
    const product = await this.productService.findById(id);
    if (!product) throw new NotFoundException('Product not found');

    const publicDir = path.join(process.cwd(), 'public', 'products');
    fs.mkdirSync(publicDir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_() ]/g, '_');
    fs.writeFileSync(path.join(publicDir, safeName), file.buffer);

    const imageBase = this.config.get<string>('IMAGE_BASE_URL', 'https://productsearch-api.onrender.com').replace(/\/$/, '');
    const imageUrl = `${imageBase}/uploads/products/${encodeURIComponent(safeName)}`;

    const current = product.images ?? [];
    if (!current.includes(imageUrl)) {
      await this.productService.update(id, { images: [...current, imageUrl] } as any);
    }
    return { url: imageUrl, images: [...current, imageUrl] };
  }
}
