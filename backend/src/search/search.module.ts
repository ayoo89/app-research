import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { ProductModule } from '../product/product.module';
import { CacheModule } from './cache.module';
import { Product } from '../product/product.entity';
import { SearchMetricsInterceptor } from './search.metrics.interceptor';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    forwardRef(() => ProductModule),
    CacheModule,
    DashboardModule,
  ],
  providers: [SearchService, SearchMetricsInterceptor, RateLimitGuard],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
