import { Injectable, Logger, BadRequestException, ForbiddenException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { ProductService } from '../product/product.service';
import { UserRole } from '../user/user.entity';
import * as nodemailer from 'nodemailer';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { mapCsvRowToProduct } from './csv-row.mapper';
import { SUPER_ADMIN_EMAIL } from '../auth/super-admin.constants';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private userService: UserService,
    private productService: ProductService,
    private config: ConfigService,
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
      // Fire-and-forget — never block or fail the invite on email errors
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

  async importFromCsv(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const products: any[] = [];
    const errors: string[] = [];

    await new Promise<void>((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (row: Record<string, unknown>) => {
          const mapped = mapCsvRowToProduct(row);
          if (!mapped) {
            errors.push(`Ligne sans désignation (DESIGNATION / name): ${JSON.stringify(row)}`);
            return;
          }
          products.push(mapped);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (products.length > 0) {
      await this.productService.bulkCreate(products);
    }

    return { imported: products.length, errors };
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
