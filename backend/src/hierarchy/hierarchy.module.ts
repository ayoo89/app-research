import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Family } from './family.entity';
import { SubFamily } from './sub-family.entity';
import { CategoryEntity } from './category.entity';
import { HierarchyService } from './hierarchy.service';
import { HierarchyController } from './hierarchy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Family, SubFamily, CategoryEntity])],
  providers: [HierarchyService],
  controllers: [HierarchyController],
  exports: [HierarchyService],
})
export class HierarchyModule implements OnModuleInit {
  constructor(private hierarchyService: HierarchyService) {}

  async onModuleInit() {
    await this.hierarchyService.bootstrapFromTaxonomy();
  }
}
