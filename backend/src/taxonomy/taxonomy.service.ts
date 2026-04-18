import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Taxonomy, TaxonomyType } from './taxonomy.entity';

@Injectable()
export class TaxonomyService {
  constructor(@InjectRepository(Taxonomy) private repo: Repository<Taxonomy>) {}

  findAll(type?: TaxonomyType): Promise<Taxonomy[]> {
    return type
      ? this.repo.find({ where: { type }, order: { name: 'ASC' } })
      : this.repo.find({ order: { type: 'ASC', name: 'ASC' } });
  }

  async getNames(type: TaxonomyType): Promise<string[]> {
    const rows = await this.repo.find({ where: { type }, order: { name: 'ASC' }, select: ['name'] });
    return rows.map((r) => r.name);
  }

  async create(dto: { type: TaxonomyType; name: string; parentName?: string }): Promise<Taxonomy> {
    const trimmed = dto.name.trim();
    if (!trimmed) throw new ConflictException('Le nom ne peut pas être vide');
    const existing = await this.repo.findOne({ where: { type: dto.type, name: trimmed } });
    if (existing) throw new ConflictException('Cette entrée existe déjà');
    return this.repo.save(this.repo.create({ type: dto.type, name: trimmed, parentName: dto.parentName?.trim() || null }));
  }

  async update(id: string, dto: { name?: string; parentName?: string }): Promise<Taxonomy> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Entrée introuvable');
    if (dto.name !== undefined) entry.name = dto.name.trim();
    if (dto.parentName !== undefined) entry.parentName = dto.parentName?.trim() || null;
    return this.repo.save(entry);
  }

  async remove(id: string): Promise<void> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Entrée introuvable');
    await this.repo.delete(id);
  }
}
