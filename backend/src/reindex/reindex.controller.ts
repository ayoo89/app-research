import { Controller, Post, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/user.entity';
import { ReindexService } from './reindex.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/reindex')
export class ReindexController {
  constructor(private reindexService: ReindexService) {}

  @Post('full')
  @ApiOperation({ summary: 'Queue all products for embedding regeneration' })
  fullReindex() { return this.reindexService.fullReindex(); }

  @Post('partial')
  @ApiOperation({ summary: 'Queue only products with missing embeddings' })
  partialReindex() { return this.reindexService.partialReindex(); }

  @Post('category')
  @ApiOperation({ summary: 'Reindex all products in a category' })
  reindexCategory(@Query('name') name: string) {
    return this.reindexService.reindexCategory(name);
  }

  @Get('status')
  @ApiOperation({ summary: 'Embedding queue status' })
  status() { return this.reindexService.queueStatus(); }

  @Get('failed')
  @ApiOperation({ summary: 'List failed embedding jobs' })
  failed() { return this.reindexService.getFailedJobs(); }

  @Post('retry-failed')
  @ApiOperation({ summary: 'Retry all failed embedding jobs' })
  retryFailed() { return this.reindexService.retryFailed(); }
}
