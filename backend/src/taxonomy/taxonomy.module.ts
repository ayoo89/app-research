import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Taxonomy } from './taxonomy.entity';
import { TaxonomyService } from './taxonomy.service';

@Module({
  imports: [TypeOrmModule.forFeature([Taxonomy])],
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
