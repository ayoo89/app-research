import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
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
    const user = await this.userService.create(email, name, role);
    await this.sendInviteEmail(email, name, user.inviteToken);
    return { message: 'Invite sent', userId: user.id };
  }

  async createUserWithPassword(
    email: string,
    name: string,
    role: UserRole,
    password: string,
  ) {
    const user = await this.userService.createUserWithPassword(email, name, role, password);
    const { password: _p, inviteToken: _i, ...safe } = user as any;
    return { message: 'Utilisateur créé', user: safe };
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

  // ── Product Import ────────────────────────────────────────────────

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

  // ── Email ─────────────────────────────────────────────────────────

  private async sendInviteEmail(email: string, name: string, token: string) {
    const transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT'),
      auth: { user: this.config.get('SMTP_USER'), pass: this.config.get('SMTP_PASS') },
    });

    const inviteUrl = `${this.config.get('APP_URL', 'http://localhost:3000')}/accept-invite?token=${token}`;

    await transporter.sendMail({
      from: this.config.get('SMTP_USER'),
      to: email,
      subject: 'You have been invited',
      html: `<p>Hi ${name},</p><p>Click <a href="${inviteUrl}">here</a> to set your password and activate your account.</p>`,
    });

    this.logger.log(`Invite email sent to ${email}`);
  }
}
