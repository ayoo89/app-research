import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

export type TaxonomyType = 'category' | 'family' | 'subcategory';

@Entity('taxonomy')
@Unique(['type', 'name'])
export class Taxonomy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: TaxonomyType;

  @Column()
  name: string;

  @Column({ nullable: true })
  parentName: string;

  @CreateDateColumn()
  createdAt: Date;
}
