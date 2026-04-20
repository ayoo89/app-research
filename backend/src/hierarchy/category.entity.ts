import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Unique, Index,
} from 'typeorm';
import { SubFamily } from './sub-family.entity';

@Entity('product_categories')
@Unique(['subFamilyId', 'name'])
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Index() @Column() subFamilyId: string;
  @ManyToOne(() => SubFamily, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'subFamilyId' })
  subFamily: SubFamily;
  @CreateDateColumn() createdAt: Date;
}
