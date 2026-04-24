import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Product } from '../product/product.entity';
import { ReindexService } from './reindex.service';
import { ReindexController } from './reindex.controller';
import { ProductModule } from '../product/product.module';
import { CacheModule } from '../search/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    BullModule.registerQueue({ name: 'embedding' }),
    ProductModule,
    CacheModule,
  ],
  providers: [ReindexService],
  controllers: [ReindexController],
})
export class ReindexModule {}
