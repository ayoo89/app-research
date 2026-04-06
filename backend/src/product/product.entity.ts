import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  brand: string;

  @Index({ unique: true, where: '"barcode" IS NOT NULL' })
  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'jsonb', default: [] })
  images: string[];

  // Stored as float array; actual vector search done via Elasticsearch or pgvector
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
