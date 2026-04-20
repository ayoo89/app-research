import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('search_events')
export class SearchEvent {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  type: 'barcode' | 'text' | 'image';

  @Column({ nullable: true, type: 'text' })
  query: string | null;

  @Column({ nullable: true })
  matchedProductId: string | null;

  @Column({ nullable: true, type: 'int' })
  latencyMs: number | null;

  @Column({ default: false })
  cacheHit: boolean;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
