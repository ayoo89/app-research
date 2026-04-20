import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchEvent } from './search-event.entity';
import { SearchEventService } from './search-event.service';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Product } from '../product/product.entity';
import { User } from '../user/user.entity';
import { CacheModule } from '../search/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SearchEvent, Product, User]),
    CacheModule,
  ],
  providers: [SearchEventService, DashboardService],
  controllers: [DashboardController],
  exports: [SearchEventService],
})
export class DashboardModule {}
