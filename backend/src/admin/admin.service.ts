import { Injectable, Logger, BadRequestException, ForbiddenException, HttpException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { ProductService } from '../product/product.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { UserRole } from '../user/user.entity';
import * as nodemailer from 'nodemailer';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { mapCsvRowToProduct } from './csv-row.mapper';
import { SUPER_ADMIN_EMAIL } from '../auth/super-admin.constants';
import { REDIS_CLIENT } from '../search/cache.module';

export interface ImageUploadDetail {
  filename: string;
  matched: boolean;
  productName?: string;
  productId?: string;
  reason?: string;
}

export interface ProductImportRow {
  name: string;
  codeGold?: string | null;
  success: boolean;
  reason?: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private userService: UserService,
    private productService: ProductService,
    private taxonomyService: TaxonomyService,
    private config: ConfigService,
    @Inject(REDIS_CLIENT) private redis: any,
  ) {}

  // ── User Management ──────────────────────────────────────────────

  listUsers() {
    return this.userService.findAll();
  }

  async inviteUser(email: string, name: string, role: UserRole) {
    if (email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.trim().toLowerCase()) {
      throw new BadRequestException('Cet e-mail est réservé au super administrateur');
    }
    try {
      const tempPassword = this.userService.generateTempPassword();
      const user = await this.userService.createUserWithPassword(email, name, role, tempPassword);
      this.sendCredentialsEmail(email, name, tempPassword).catch((err) =>
        this.logger.error(`Email error for ${email}: ${err?.message}`),
      );
      return { message: "Invitation envoyée avec succès", userId: user.id };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`inviteUser unexpected error: ${err?.message}`, err?.stack);
      throw new BadRequestException(err?.message ?? "Échec de l'invitation");
    }
  }

  async createUserWithPassword(email: string, name: string, role: UserRole, password: string) {
    const user = await this.userService.createUserWithPassword(email, name, role, password);
    const { password: _p, inviteToken: _i, ...safe } = user as any;
    return { message: 'Utilisateur créé', user: safe };
  }

  async resetUserPassword(id: string): Promise<{ message: string }> {
    const user = await this.userService.findById(id);
    if (!user) throw new BadRequestException('Utilisateur introuvable');
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.trim().toLowerCase()) {
      throw new ForbiddenException('Impossible de réinitialiser le mot de passe du super administrateur');
    }
    const tempPassword = await this.userService.resetPasswordById(id);
    await this.sendPasswordResetEmail(user.email, user.name ?? user.email, tempPassword);
    return { message: "Mot de passe réinitialisé et envoyé à l'utilisateur" };
  }

  async updateUser(id: string, data: any) {
    const existing = await this.userService.findById(id);
    if (!existing) throw new BadRequestException('Utilisateur introuvable');
    if (existing.email.toLowerCase() === SUPER_ADMIN_EMAIL.trim().toLowerCase()) {
      if (data.role && data.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Impossible de modifier le rôle du super administrateur');
      }
      if (data.isActive === false) {
        throw new ForbiddenException('Impossible de désactiver le super administrateur');
      }
    }
    return this.userService.update(id, data);
  }

  async removeUser(id: string) {
    const existing = await this.userService.findById(id);
    if (existing?.email.toLowerCase() === SUPER_ADMIN_EMAIL.trim().toLowerCase()) {
      throw new ForbiddenException('Impossible de supprimer le super administrateur');
    }
    return this.userService.remove(id);
  }

  // ── Product Import / Export ───────────────────────────────────────

  private async parseCsvBuffer(buffer: Buffer): Promise<{ rows: any[]; errors: string[] }> {
    const rows: any[] = [];
    const errors: string[] = [];
    await new Promise<void>((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (row: Record<string, unknown>) => {
          const mapped = mapCsvRowToProduct(row);
          if (!mapped) {
            errors.push(`Row missing designation: ${JSON.stringify(row)}`);
          } else {
            rows.push(mapped);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    return { rows, errors };
  }

  private parseXlsxBuffer(buffer: Buffer): { rows: any[]; errors: string[] } {
    const errors: string[] = [];
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    const rows = rawRows
      .map((row) => {
        const mapped = mapCsvRowToProduct(row);
        if (!mapped) errors.push(`Row missing designation: ${JSON.stringify(row)}`);
        return mapped;
      })
      .filter(Boolean);
    return { rows, errors };
  }

  private isXlsx(buffer: Buffer): boolean {
    return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4B;
  }

  private saveImageFile(imgFile: Express.Multer.File, imageBase: string): string {
    const publicDir = path.join(process.cwd(), 'public', 'products');
    fs.mkdirSync(publicDir, { recursive: true });
    const safeName = imgFile.originalname.replace(/[^a-zA-Z0-9.\-_() ]/g, '_');
    fs.writeFileSync(path.join(publicDir, safeName), imgFile.buffer);
    return `${imageBase}/uploads/products/${encodeURIComponent(safeName)}`;
  }

  private async assignImageToProduct(productId: string, imageUrl: string) {
    const full = await this.productService.findById(productId);
    const current = full?.images ?? [];
    if (!current.includes(imageUrl)) {
      await this.productService.update(productId, { images: [...current, imageUrl] } as any);
    }
  }

  private stemFromFilename(originalname: string): string {
    const safe = originalname.replace(/[^a-zA-Z0-9.\-_() ]/g, '_');
    return path.basename(safe, path.extname(safe)).trim();
  }

  /** Match images to products by position (1.jpg → product[0], 2.jpg → product[1], …) */
  private async matchByOrder(
    imageFiles: Express.Multer.File[],
    products: Array<{ id: string; name?: string }>,
    imageBase: string,
  ): Promise<{ uploaded: number; matched: number; imageResults: ImageUploadDetail[] }> {
    const numFromName = (name: string) => {
      const m = name.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
    };
    const sorted = [...imageFiles].sort(
      (a, b) => numFromName(a.originalname) - numFromName(b.originalname),
    );

    let matched = 0;
    const imageResults: ImageUploadDetail[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const imgFile = sorted[i];
      const imageUrl = this.saveImageFile(imgFile, imageBase);
      const lineIdx = numFromName(imgFile.originalname) - 1;
      const product = products[lineIdx] ?? products[i];
      if (product) {
        try {
          await this.assignImageToProduct(product.id, imageUrl);
          matched++;
          imageResults.push({
            filename: imgFile.originalname,
            matched: true,
            productName: product.name,
            productId: product.id,
          });
        } catch (e: any) {
          this.logger.warn(`Order match update failed: ${e.message}`);
          imageResults.push({ filename: imgFile.originalname, matched: false, reason: e.message });
        }
      } else {
        imageResults.push({ filename: imgFile.originalname, matched: false, reason: 'No product at this position' });
      }
    }
    return { uploaded: imageFiles.length, matched, imageResults };
  }

  /** Match images to products by filename stem == product codeGold or normalized name */
  private async matchByCodeGold(
    imageFiles: Express.Multer.File[],
    products: Array<{ id: string; codeGold?: string | null; name?: string }>,
    imageBase: string,
  ): Promise<{ uploaded: number; matched: number; imageResults: ImageUploadDetail[] }> {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    let matched = 0;
    const imageResults: ImageUploadDetail[] = [];

    for (const imgFile of imageFiles) {
      const imageUrl = this.saveImageFile(imgFile, imageBase);
      const stem = this.stemFromFilename(imgFile.originalname).toLowerCase();

      const product = products.find(
        (p) =>
          (p.codeGold && p.codeGold.toLowerCase() === stem) ||
          (p.name && normalize(p.name) === normalize(stem)),
      );

      if (product) {
        try {
          await this.assignImageToProduct(product.id, imageUrl);
          matched++;
          imageResults.push({
            filename: imgFile.originalname,
            matched: true,
            productName: product.name,
            productId: product.id,
          });
        } catch (e: any) {
          this.logger.warn(`CodeGold match update failed for ${product.id}: ${e.message}`);
          imageResults.push({ filename: imgFile.originalname, matched: false, reason: e.message });
        }
      } else {
        imageResults.push({
          filename: imgFile.originalname,
          matched: false,
          reason: `No product matching codeGold or name "${stem}"`,
        });
      }
    }
    return { uploaded: imageFiles.length, matched, imageResults };
  }

  /** Match images to products by filename stem == product barcode */
  private async matchByBarcode(
    imageFiles: Express.Multer.File[],
    products: Array<{ id: string; barcode?: string | null; name?: string }>,
    imageBase: string,
  ): Promise<{ uploaded: number; matched: number; imageResults: ImageUploadDetail[] }> {
    let matched = 0;
    const imageResults: ImageUploadDetail[] = [];

    for (const imgFile of imageFiles) {
      const imageUrl = this.saveImageFile(imgFile, imageBase);
      const stem = this.stemFromFilename(imgFile.originalname).trim();

      const product = products.find((p) => p.barcode?.trim() === stem);

      if (product) {
        try {
          await this.assignImageToProduct(product.id, imageUrl);
          matched++;
          imageResults.push({
            filename: imgFile.originalname,
            matched: true,
            productName: product.name,
            productId: product.id,
          });
        } catch (e: any) {
          imageResults.push({ filename: imgFile.originalname, matched: false, reason: e.message });
        }
      } else {
        imageResults.push({
          filename: imgFile.originalname,
          matched: false,
          reason: `No product with barcode "${stem}"`,
        });
      }
    }
    return { uploaded: imageFiles.length, matched, imageResults };
  }

  async importFromFile(
    productFile: Express.Multer.File,
    imageFiles: Express.Multer.File[],
    strategy: 'order' | 'codegold' = 'codegold',
  ): Promise<{
    imported: number;
    imagesUploaded: number;
    imagesMatched: number;
    errors: string[];
    imageResults: ImageUploadDetail[];
    productResults: ProductImportRow[];
  }> {
    const { rows: products, errors } = this.isXlsx(productFile.buffer)
      ? this.parseXlsxBuffer(productFile.buffer)
      : await this.parseCsvBuffer(productFile.buffer);

    if (products.length === 0) {
      const productResults: ProductImportRow[] = errors.map((e) => ({ name: '—', success: false, reason: e }));
      return { imported: 0, imagesUploaded: imageFiles.length, imagesMatched: 0, errors, imageResults: [], productResults };
    }

    const seen = new Set<string>();
    for (const p of products) {
      const entries: Array<{ type: 'category' | 'family' | 'subcategory'; name: string; parentName?: string }> = [];
      if (p.family)      entries.push({ type: 'family',      name: p.family });
      if (p.subcategory) entries.push({ type: 'subcategory', name: p.subcategory, parentName: p.family });
      if (p.category)    entries.push({ type: 'category',    name: p.category,    parentName: p.subcategory });
      for (const entry of entries) {
        const key = `${entry.type}:${entry.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        try { await this.taxonomyService.create(entry); } catch { /* already exists */ }
      }
    }

    const upserted = await this.productService.bulkUpsert(products);

    const imageBase = this.config
      .get<string>('IMAGE_BASE_URL', 'https://productsearch-api.onrender.com')
      .replace(/\/$/, '');

    const { uploaded, matched, imageResults } = strategy === 'order'
      ? await this.matchByOrder(imageFiles, upserted, imageBase)
      : await this.matchByCodeGold(imageFiles, upserted, imageBase);

    const productResults: ProductImportRow[] = [
      ...upserted.map((p) => ({ name: p.name, codeGold: p.codeGold ?? null, success: true })),
      ...errors.map((e) => ({ name: '—', success: false, reason: e })),
    ];

    // Track import stats in Redis for dashboard
    const successRate = products.length > 0 ? upserted.length / products.length : 0;
    this.redis.hset('import:last',
      'totalImported', String(upserted.length),
      'lastImportAt', new Date().toISOString(),
      'lastImportRows', String(products.length),
      'lastImportSuccessRate', String(successRate),
    ).catch(() => {});

    return { imported: products.length, imagesUploaded: uploaded, imagesMatched: matched, errors, imageResults, productResults };
  }

  /**
   * Standalone image upload: match images to ALL existing products by filename.
   * strategy='codegold' → filename stem matches codeGold or product name.
   * strategy='barcode'  → filename stem matches barcode exactly.
   */
  async uploadImagesToProducts(
    imageFiles: Express.Multer.File[],
    strategy: 'codegold' | 'barcode' = 'codegold',
  ): Promise<{
    uploaded: number;
    matched: number;
    errors: string[];
    imageResults: ImageUploadDetail[];
  }> {
    const imageBase = this.config
      .get<string>('IMAGE_BASE_URL', 'https://productsearch-api.onrender.com')
      .replace(/\/$/, '');

    const [allProducts] = await this.productService.findAll(1, 100_000);

    const { uploaded, matched, imageResults } = strategy === 'barcode'
      ? await this.matchByBarcode(imageFiles, allProducts, imageBase)
      : await this.matchByCodeGold(imageFiles, allProducts, imageBase);

    const errors = imageResults
      .filter((r) => !r.matched)
      .map((r) => `${r.filename}: ${r.reason ?? 'No match'}`);

    return { uploaded, matched, errors, imageResults };
  }

  /** @deprecated use importFromFile */
  async importFromCsv(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const fakeFile = { buffer, originalname: 'import.csv' } as Express.Multer.File;
    const { imported, errors } = await this.importFromFile(fakeFile, [], 'codegold');
    return { imported, errors };
  }

  async exportToCsv(): Promise<string> {
    const [items] = await this.productService.findAll(1, 100_000);
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'code_gold,designation,ean,marque,categorie,famille,sous_famille,description';
    const rows = items.map((p: any) => [
      p.codeGold, p.name, p.barcode, p.brand,
      p.category, p.family, p.subcategory, p.description,
    ].map(escape).join(','));
    return [header, ...rows].join('\n');
  }

  // ── Email ─────────────────────────────────────────────────────────

  private createTransporter() {
    return nodemailer.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      auth: { user: this.config.get('SMTP_USER'), pass: this.config.get('SMTP_PASS') },
    });
  }

  private async sendCredentialsEmail(email: string, name: string, tempPassword: string): Promise<boolean> {
    if (!this.config.get('SMTP_HOST')) {
      this.logger.warn(`SMTP_HOST not configured — skipping credentials email to ${email}`);
      return false;
    }
    try {
      const appUrl = this.config.get('APP_URL', 'http://localhost:3000');
      await this.createTransporter().sendMail({
        from: this.config.get('SMTP_USER'),
        to: email,
        subject: 'Bienvenue — Vos identifiants de connexion',
        html: `
          <p>Bonjour ${name},</p>
          <p>Votre compte a été créé. Voici vos identifiants :</p>
          <ul>
            <li><strong>E-mail :</strong> ${email}</li>
            <li><strong>Mot de passe temporaire :</strong> <code>${tempPassword}</code></li>
          </ul>
          <p>Connectez-vous sur <a href="${appUrl}">${appUrl}</a> et changez votre mot de passe dès la première connexion via votre profil.</p>
        `,
      });
      this.logger.log(`Credentials email sent to ${email}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send credentials email to ${email}: ${err.message}`);
      return false;
    }
  }

  private async sendPasswordResetEmail(email: string, name: string, tempPassword: string): Promise<boolean> {
    if (!this.config.get('SMTP_HOST')) {
      this.logger.warn(`SMTP_HOST not configured — skipping password reset email to ${email}`);
      return false;
    }
    try {
      const appUrl = this.config.get('APP_URL', 'http://localhost:3000');
      await this.createTransporter().sendMail({
        from: this.config.get('SMTP_USER'),
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        html: `
          <p>Bonjour ${name},</p>
          <p>Votre mot de passe a été réinitialisé par l'administrateur. Voici vos nouveaux identifiants :</p>
          <ul>
            <li><strong>E-mail :</strong> ${email}</li>
            <li><strong>Mot de passe temporaire :</strong> <code>${tempPassword}</code></li>
          </ul>
          <p>Connectez-vous sur <a href="${appUrl}">${appUrl}</a> et modifiez votre mot de passe via votre profil.</p>
        `,
      });
      this.logger.log(`Password reset email sent to ${email}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send password reset email to ${email}: ${err.message}`);
      return false;
    }
  }
}
