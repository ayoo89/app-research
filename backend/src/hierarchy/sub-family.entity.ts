import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Unique, Index,
} from 'typeorm';
import { Family } from './family.entity';

@Entity('sub_families')
@Unique(['familyId', 'name'])
export class SubFamily {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Index() @Column() familyId: string;
  @ManyToOne(() => Family, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'familyId' })
  family: Family;
  @OneToMany('CategoryEntity', 'subFamily') categories: any[];
  @CreateDateColumn() createdAt: Date;
}
