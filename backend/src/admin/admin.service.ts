import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { ProductService } from '../product/product.service';
import { UserRole } from '../user/user.entity';
import * as nodemailer from 'nodemailer';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

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
    const user = await this.userService.create(email, name, role);
    await this.sendInviteEmail(email, name, user.inviteToken);
    return { message: 'Invite sent', userId: user.id };
  }

  updateUser(id: string, data: any) {
    return this.userService.update(id, data);
  }

  removeUser(id: string) {
    return this.userService.remove(id);
  }

  // ── Product Import ────────────────────────────────────────────────

  async importFromCsv(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const products: any[] = [];
    const errors: string[] = [];

    await new Promise<void>((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (row) => {
          if (!row.name) { errors.push(`Row missing name: ${JSON.stringify(row)}`); return; }
          products.push({
            name: row.name,
            brand: row.brand,
            barcode: row.barcode,
            description: row.description,
            category: row.category,
            images: row.images ? row.images.split('|') : [],
          });
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
