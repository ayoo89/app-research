import {
  Injectable, NotFoundException, ConflictException, Logger, Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Redis from 'ioredis';
import { Family } from './family.entity';
import { SubFamily } from './sub-family.entity';
import { CategoryEntity } from './category.entity';
import { REDIS_CLIENT } from '../search/cache.module';

const HIER_TTL = 300; // 5 min

@Injectable()
export class HierarchyService {
  private readonly logger = new Logger(HierarchyService.name);

  constructor(
    @InjectRepository(Family) private familyRepo: Repository<Family>,
    @InjectRepository(SubFamily) private subFamilyRepo: Repository<SubFamily>,
    @InjectRepository(CategoryEntity) private categoryRepo: Repository<CategoryEntity>,
    private dataSource: DataSource,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  private async invalidateHierarchyCache(): Promise<void> {
    try {
      const keys = await this.redis.keys('hier:*');
      if (keys.length > 0) await this.redis.del(...keys);
    } catch { /* ignore cache errors */ }
  }

  // ── Families ──────────────────────────────────────────────────────

  async listFamilies(): Promise<Array<Family & { subFamilyCount: number }>> {
    const key = 'hier:families';
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }

    const rows = await this.dataSource.query(`
      SELECT f.id, f.name, f."createdAt",
             COUNT(sf.id)::int AS "subFamilyCount"
      FROM families f
      LEFT JOIN sub_families sf ON sf."familyId" = f.id
      GROUP BY f.id
      ORDER BY f.name ASC
    `);
    this.redis.setex(key, HIER_TTL, JSON.stringify(rows)).catch(() => {});
    return rows;
  }

  async createFamily(name: string): Promise<Family> {
    const trimmed = name.trim();
    if (!trimmed) throw new ConflictException('Le nom ne peut pas être vide');
    const existing = await this.familyRepo.findOne({ where: { name: trimmed } });
    if (existing) throw new ConflictException('Cette famille existe déjà');
    const result = await this.familyRepo.save(this.familyRepo.create({ name: trimmed }));
    await this.invalidateHierarchyCache();
    return result;
  }

  async updateFamily(id: string, name: string): Promise<Family> {
    const family = await this.familyRepo.findOne({ where: { id } });
    if (!family) throw new NotFoundException('Famille introuvable');
    family.name = name.trim();
    const result = await this.familyRepo.save(family);
    await this.invalidateHierarchyCache();
    return result;
  }

  async removeFamily(id: string): Promise<void> {
    const family = await this.familyRepo.findOne({ where: { id } });
    if (!family) throw new NotFoundException('Famille introuvable');
    const count = await this.subFamilyRepo.count({ where: { familyId: id } });
    if (count > 0) throw new ConflictException(`Impossible de supprimer : ${count} sous-famille(s) liée(s)`);
    await this.familyRepo.delete(id);
    await this.invalidateHierarchyCache();
  }

  async findOrCreateFamily(name: string): Promise<Family> {
    const trimmed = name.trim();
    const existing = await this.familyRepo.findOne({ where: { name: trimmed } });
    if (existing) return existing;
    return this.familyRepo.save(this.familyRepo.create({ name: trimmed }));
  }

  // ── Sub-Families ──────────────────────────────────────────────────

  async listSubFamilies(familyId?: string): Promise<Array<SubFamily & { categoryCount: number; familyName: string }>> {
    const key = `hier:sf:${familyId ?? 'all'}`;
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }

    const params: any[] = [];
    let where = '';
    if (familyId) {
      params.push(familyId);
      where = `WHERE sf."familyId" = $1`;
    }
    const rows = await this.dataSource.query(`
      SELECT sf.id, sf.name, sf."familyId", sf."createdAt",
             f.name AS "familyName",
             COUNT(c.id)::int AS "categoryCount"
      FROM sub_families sf
      LEFT JOIN families f ON f.id = sf."familyId"
      LEFT JOIN product_categories c ON c."subFamilyId" = sf.id
      ${where}
      GROUP BY sf.id, f.name
      ORDER BY f.name ASC, sf.name ASC
    `, params);
    this.redis.setex(key, HIER_TTL, JSON.stringify(rows)).catch(() => {});
    return rows;
  }

  async createSubFamily(name: string, familyId: string): Promise<SubFamily> {
    const trimmed = name.trim();
    if (!trimmed) throw new ConflictException('Le nom ne peut pas être vide');
    const family = await this.familyRepo.findOne({ where: { id: familyId } });
    if (!family) throw new NotFoundException('Famille introuvable');
    const existing = await this.subFamilyRepo.findOne({ where: { familyId, name: trimmed } });
    if (existing) throw new ConflictException('Cette sous-famille existe déjà dans cette famille');
    const result = await this.subFamilyRepo.save(this.subFamilyRepo.create({ name: trimmed, familyId }));
    await this.invalidateHierarchyCache();
    return result;
  }

  async updateSubFamily(id: string, dto: { name?: string; familyId?: string }): Promise<SubFamily> {
    const sf = await this.subFamilyRepo.findOne({ where: { id } });
    if (!sf) throw new NotFoundException('Sous-famille introuvable');
    if (dto.familyId) {
      const family = await this.familyRepo.findOne({ where: { id: dto.familyId } });
      if (!family) throw new NotFoundException('Famille introuvable');
      sf.familyId = dto.familyId;
    }
    if (dto.name) sf.name = dto.name.trim();
    const result = await this.subFamilyRepo.save(sf);
    await this.invalidateHierarchyCache();
    return result;
  }

  async removeSubFamily(id: string): Promise<void> {
    const sf = await this.subFamilyRepo.findOne({ where: { id } });
    if (!sf) throw new NotFoundException('Sous-famille introuvable');
    const count = await this.categoryRepo.count({ where: { subFamilyId: id } });
    if (count > 0) throw new ConflictException(`Impossible de supprimer : ${count} catégorie(s) liée(s)`);
    await this.subFamilyRepo.delete(id);
    await this.invalidateHierarchyCache();
  }

  async findOrCreateSubFamily(name: string, familyId: string): Promise<SubFamily> {
    const trimmed = name.trim();
    const existing = await this.subFamilyRepo.findOne({ where: { familyId, name: trimmed } });
    if (existing) return existing;
    return this.subFamilyRepo.save(this.subFamilyRepo.create({ name: trimmed, familyId }));
  }

  // ── Categories ────────────────────────────────────────────────────

  async listCategories(subFamilyId?: string): Promise<Array<CategoryEntity & { productCount: number; subFamilyName: string; familyName: string }>> {
    const key = `hier:cats:${subFamilyId ?? 'all'}`;
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }

    const params: any[] = [];
    let where = '';
    if (subFamilyId) {
      params.push(subFamilyId);
      where = `WHERE c."subFamilyId" = $1`;
    }
    const rows = await this.dataSource.query(`
      SELECT c.id, c.name, c."subFamilyId", c."createdAt",
             sf.name AS "subFamilyName",
             f.name AS "familyName",
             COUNT(p.id)::int AS "productCount"
      FROM product_categories c
      LEFT JOIN sub_families sf ON sf.id = c."subFamilyId"
      LEFT JOIN families f ON f.id = sf."familyId"
      LEFT JOIN products p ON lower(p.category) = lower(c.name)
      ${where}
      GROUP BY c.id, sf.name, f.name
      ORDER BY f.name ASC, sf.name ASC, c.name ASC
    `, params);
    this.redis.setex(key, HIER_TTL, JSON.stringify(rows)).catch(() => {});
    return rows;
  }

  async createCategory(name: string, subFamilyId: string): Promise<CategoryEntity> {
    const trimmed = name.trim();
    if (!trimmed) throw new ConflictException('Le nom ne peut pas être vide');
    const sf = await this.subFamilyRepo.findOne({ where: { id: subFamilyId } });
    if (!sf) throw new NotFoundException('Sous-famille introuvable');
    const existing = await this.categoryRepo.findOne({ where: { subFamilyId, name: trimmed } });
    if (existing) throw new ConflictException('Cette catégorie existe déjà dans cette sous-famille');
    const result = await this.categoryRepo.save(this.categoryRepo.create({ name: trimmed, subFamilyId }));
    await this.invalidateHierarchyCache();
    return result;
  }

  async updateCategory(id: string, dto: { name?: string; subFamilyId?: string }): Promise<CategoryEntity> {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Catégorie introuvable');
    if (dto.subFamilyId) {
      const sf = await this.subFamilyRepo.findOne({ where: { id: dto.subFamilyId } });
      if (!sf) throw new NotFoundException('Sous-famille introuvable');
      cat.subFamilyId = dto.subFamilyId;
    }
    if (dto.name) cat.name = dto.name.trim();
    const result = await this.categoryRepo.save(cat);
    await this.invalidateHierarchyCache();
    return result;
  }

  async removeCategory(id: string): Promise<void> {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Catégorie introuvable');
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*)::int FROM products WHERE lower(category) = lower($1)`, [cat.name],
    );
    if (count > 0) throw new ConflictException(`Impossible de supprimer : ${count} produit(s) lié(s)`);
    await this.categoryRepo.delete(id);
    await this.invalidateHierarchyCache();
  }

  async findOrCreateCategory(name: string, subFamilyId: string): Promise<CategoryEntity> {
    const trimmed = name.trim();
    const existing = await this.categoryRepo.findOne({ where: { subFamilyId, name: trimmed } });
    if (existing) return existing;
    return this.categoryRepo.save(this.categoryRepo.create({ name: trimmed, subFamilyId }));
  }

  // ── Bootstrap (populate from taxonomy table on startup) ───────────

  async bootstrapFromTaxonomy(): Promise<void> {
    try {
      const [families, subfamilies, categories] = await Promise.all([
        this.dataSource.query(`SELECT name FROM taxonomy WHERE type='family' ORDER BY name`).catch(() => []),
        this.dataSource.query(`SELECT name, "parentName" FROM taxonomy WHERE type='subcategory' ORDER BY name`).catch(() => []),
        this.dataSource.query(`SELECT name, "parentName" FROM taxonomy WHERE type='category' ORDER BY name`).catch(() => []),
      ]);

      const [pFamilies, pSubcats, pCats] = await Promise.all([
        this.dataSource.query(`SELECT DISTINCT family AS name FROM products WHERE family IS NOT NULL AND family != '' ORDER BY family`).catch(() => []),
        this.dataSource.query(`SELECT DISTINCT subcategory AS name FROM products WHERE subcategory IS NOT NULL AND subcategory != '' ORDER BY subcategory`).catch(() => []),
        this.dataSource.query(`SELECT DISTINCT category AS name FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category`).catch(() => []),
      ]);

      const allFamilyNames = [...new Set([
        ...families.map((r: any) => r.name),
        ...pFamilies.map((r: any) => r.name),
      ])].filter(Boolean);

      for (const name of allFamilyNames) {
        await this.findOrCreateFamily(name).catch(() => {});
      }

      let defaultFamily: Family | null = null;
      const allSubNames = [...new Set([
        ...subfamilies.map((r: any) => r.name),
        ...pSubcats.map((r: any) => r.name),
      ])].filter(Boolean);

      for (const name of allSubNames) {
        const sfRow = subfamilies.find((r: any) => r.name === name);
        const parentName = sfRow?.parentName;
        let parentFamily = parentName
          ? await this.familyRepo.findOne({ where: { name: parentName } })
          : null;
        if (!parentFamily && allFamilyNames.length > 0) {
          const productRow = await this.dataSource.query(
            `SELECT family FROM products WHERE subcategory = $1 AND family IS NOT NULL LIMIT 1`, [name],
          ).catch(() => []);
          if (productRow.length > 0) {
            parentFamily = await this.familyRepo.findOne({ where: { name: productRow[0].family } });
          }
        }
        if (!parentFamily) {
          if (!defaultFamily) {
            defaultFamily = await this.findOrCreateFamily('Général').catch(() => null);
          }
          parentFamily = defaultFamily;
        }
        if (parentFamily) {
          await this.findOrCreateSubFamily(name, parentFamily.id).catch(() => {});
        }
      }

      const allCatNames = [...new Set([
        ...categories.map((r: any) => r.name),
        ...pCats.map((r: any) => r.name),
      ])].filter(Boolean);

      for (const name of allCatNames) {
        const catRow = categories.find((r: any) => r.name === name);
        const parentName = catRow?.parentName;
        let parentSf = parentName
          ? await this.subFamilyRepo.findOne({ where: { name: parentName } })
          : null;
        if (!parentSf) {
          const productRow = await this.dataSource.query(
            `SELECT subcategory FROM products WHERE category = $1 AND subcategory IS NOT NULL LIMIT 1`, [name],
          ).catch(() => []);
          if (productRow.length > 0) {
            parentSf = await this.subFamilyRepo.findOne({ where: { name: productRow[0].subcategory } });
          }
        }
        if (!parentSf) {
          const anyFamily = await this.familyRepo.findOne({ where: {} });
          if (anyFamily) {
            parentSf = await this.findOrCreateSubFamily('Général', anyFamily.id).catch(() => null);
          }
        }
        if (parentSf) {
          await this.findOrCreateCategory(name, parentSf.id).catch(() => {});
        }
      }

      await this.invalidateHierarchyCache();
      this.logger.log('Hierarchy bootstrap complete');
    } catch (err: any) {
      this.logger.warn(`Hierarchy bootstrap partial: ${err.message}`);
    }
  }
}
