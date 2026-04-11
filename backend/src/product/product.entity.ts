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

  /**
   * Référence interne ERP (ex. « CODE GOLD »).
   * Recherche scan / texte comme l’EAN.
   */
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

  @Column({ nullable: true })
  category: string;

  /**
   * Sous-famille ERP (colonne « Sous-Famille »), ex. FLEUR ARTIFICIELLE.
   * Hiérarchie : catégorie → famille → sous-famille.
   */
  @Column({ nullable: true })
  subcategory: string;

  /** Famille ERP (colonne « Famille »), ex. ART FLORAL. */
  @Column({ nullable: true })
  family: string;

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
