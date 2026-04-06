import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Product } from './product.entity';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { EmbeddingProcessor } from './embedding.processor';
import { EmbeddingService } from './embedding.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    BullModule.registerQueue({ name: 'embedding' }),
    forwardRef(() => SearchModule),
  ],
  providers: [ProductService, EmbeddingService, EmbeddingProcessor],
  controllers: [ProductController],
  exports: [ProductService, EmbeddingService],
})
export class ProductModule {}
