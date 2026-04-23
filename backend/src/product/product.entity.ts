import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { CategoryEntity } from '../hierarchy/category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  name: string;

  @Index({ unique: true, where: '"codeGold" IS NOT NULL' })
  @Column({ nullable: true })
  codeGold: string;

  @Column({ nullable: true })
  brand: string;

  @Index({ unique: true, where: '"barcode" IS NOT NULL' })
  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Index()
  @Column({ nullable: true })
  category: string;

  @Index()
  @Column({ nullable: true })
  subcategory: string;

  @Index()
  @Column({ nullable: true })
  family: string;

  @Index()
  @Column({ nullable: true })
  categoryId: string;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'categoryId' })
  categoryEntity: CategoryEntity;

  @Column({ type: 'jsonb', default: [] })
  images: string[];

  @Column({ type: 'float', nullable: true })
  price: number;

  @Column({ type: 'int', nullable: true })
  stock: number;

  @Column({ type: 'float', array: true, nullable: true, select: false })
  embeddingVector: number[];

  @Column({ default: false })
  embeddingGenerated: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
