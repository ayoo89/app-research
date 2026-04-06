import {
  Controller, Post, Body, UseInterceptors, UploadedFile,
  UseGuards, HttpCode, BadRequestException, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';
import { SearchInputPipe } from '../common/input-validation.pipe';
import { SearchService } from './search.service';
import { SearchMetricsInterceptor } from './search.metrics.interceptor';
import { ScoringWeights } from './search.types';

class WeightsDto implements Partial<ScoringWeights> {
  @IsOptional() @IsNumber() @Min(0) @Max(1) barcode?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) text?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) vector?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(0.5) multiMatchBoost?: number;
}

class SearchDto {
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() imageBase64?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(50) limit?: number;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => WeightsDto) weights?: WeightsDto;
}

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RateLimitGuard)
@UseInterceptors(SearchMetricsInterceptor)
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Post()
  @HttpCode(200)
  @RateLimit({ limit: 120, windowSec: 60 })  // 120 req/min per IP
  @ApiOperation({
    summary: 'Hybrid product search',
    description: 'Pipeline: barcode (exact) → text (FTS+trigram) ∥ image (CLIP KNN). Results ranked by weighted score.',
  })
  search(@Body(SearchInputPipe) dto: SearchDto, @Req() req: Request) {
    if (!dto.barcode && !dto.text && !dto.imageBase64) {
      throw new BadRequestException('Provide at least one of: barcode, text, imageBase64');
    }
    return this.searchService.search(dto, req['correlationId']);
  }

  @Post('image')
  @HttpCode(200)
  @RateLimit({ limit: 30, windowSec: 60 })   // image search is heavier
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Search by image file upload' })
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  searchByImage(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) throw new BadRequestException('Image file required');
    return this.searchService.search(
      { imageBase64: file.buffer.toString('base64') },
      req['correlationId'],
    );
  }
}
