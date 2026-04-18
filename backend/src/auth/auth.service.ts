import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { SUPER_ADMIN_EMAIL } from './super-admin.constants';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userService.findByEmail(email.trim().toLowerCase());
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload      = { sub: user.id, email: user.email, role: user.role };
    const accessToken  = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '2h'),
    });
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    };
  }

  async refresh(rawToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const hash = this.hashToken(rawToken);
    const user = await this.userService.findByRefreshTokenHash(hash);
    if (!user || !user.isActive) throw new UnauthorizedException('Refresh token invalide');

    const payload      = { sub: user.id, email: user.email, role: user.role };
    const accessToken  = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '2h'),
    });
    const refreshToken = await this.issueRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  async logout(userId: string): Promise<void> {
    await this.userService.clearRefreshToken(userId);
  }

  async acceptInvite(token: string, password: string) {
    UserService.validatePasswordComplexity(password);
    return this.userService.setPassword(token, password);
  }

  async updateProfile(
    userId: string,
    data: { name?: string; currentPassword?: string; newPassword?: string },
  ) {
    return this.userService.updateProfile(userId, data);
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      const user = await this.userService.findByEmail(email.trim().toLowerCase());
      if (user && user.isActive) await this.notifySuperAdmin(user.email, user.name ?? user.email);
    } catch { /* Never reveal whether user exists */ }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const raw  = crypto.randomUUID();
    await this.userService.storeRefreshToken(userId, this.hashToken(raw));
    return raw;
  }

  private async notifySuperAdmin(userEmail: string, userName: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      auth: { user: this.config.get('SMTP_USER'), pass: this.config.get('SMTP_PASS') },
    });
    await transporter.sendMail({
      from: this.config.get('SMTP_USER'),
      to: SUPER_ADMIN_EMAIL,
      subject: 'Demande de réinitialisation de mot de passe',
      html: `<p>L'utilisateur <strong>${userName}</strong> (${userEmail}) a demandé une réinitialisation de mot de passe. Réinitialisez-le via l'interface admin.</p>`,
    });
  }
}
