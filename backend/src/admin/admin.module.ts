import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserModule } from '../user/user.module';
import { ProductModule } from '../product/product.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { CacheModule } from '../search/cache.module';

@Module({
  imports: [UserModule, ProductModule, TaxonomyModule, CacheModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
