import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

@Entity('families')
export class Family {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) name: string;
  @OneToMany('SubFamily', 'family') subFamilies: any[];
  @CreateDateColumn() createdAt: Date;
}
