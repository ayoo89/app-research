import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { User, UserRole } from './user.entity';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { SUPER_ADMIN_EMAIL } from '../auth/super-admin.constants';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return this.repo.findOne({
      where: { email: normalized },
      select: ['id', 'email', 'name', 'role', 'isActive', 'password'],
    });
  }

  /**
   * Crée ou met à jour le super admin : rôle, mot de passe et compte actif alignés sur les constantes.
   */
  async ensureSuperAdmin(email: string, plainPassword: string): Promise<User> {
    const normalized = email.trim().toLowerCase();
    const hash = await bcrypt.hash(plainPassword, 10);
    await this.repo.upsert(
      {
        email: normalized,
        name: 'Super Admin',
        password: hash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        inviteToken: null,
      },
      { conflictPaths: ['email'], skipUpdateIfNoValuesChanged: false },
    );
    return this.repo.findOne({ where: { email: normalized } });
  }

  /**
   * Création directe (email + mot de passe) par le super admin — compte actif immédiatement.
   */
  async createUserWithPassword(
    email: string,
    name: string,
    role: UserRole,
    plainPassword: string,
  ): Promise<User> {
    const normalized = email.trim().toLowerCase();
    if (normalized === SUPER_ADMIN_EMAIL.trim().toLowerCase()) {
      throw new BadRequestException('Cet e-mail est réservé au compte super administrateur');
    }
    UserService.validatePasswordComplexity(plainPassword);
    if (role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Impossible de créer un second super administrateur via l’API');
    }
    const existing = await this.repo.findOne({ where: { email: normalized } });
    if (existing) throw new ConflictException('Cet e-mail est déjà utilisé');
    const user = this.repo.create({
      email: normalized,
      name: name?.trim() || normalized,
      password: await bcrypt.hash(plainPassword, 10),
      role,
      isActive: true,
      inviteToken: null,
    });
    try {
      return await this.repo.save(user);
    } catch (err: any) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Cet e-mail est déjà utilisé');
      }
      throw err;
    }
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findAll() {
    return this.repo.find({ select: ['id', 'email', 'name', 'role', 'isActive', 'createdAt'] });
  }

  async create(email: string, name: string, role: UserRole = UserRole.USER) {
    const inviteToken = uuidv4();
    const normalized = email.trim().toLowerCase();
    const user = this.repo.create({
      email: normalized,
      name,
      role,
      inviteToken,
      isActive: false,
    });
    return this.repo.save(user);
  }

  async setPassword(inviteToken: string, password: string) {
    const user = await this.repo.findOne({ where: { inviteToken } });
    if (!user) throw new NotFoundException('Invalid invite token');
    user.password = await bcrypt.hash(password, 10);
    user.isActive = true;
    user.inviteToken = null;
    return this.repo.save(user);
  }

  async update(id: string, data: Partial<User>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async remove(id: string) {
    await this.repo.delete(id);
  }

  async updateProfile(
    id: string,
    data: { name?: string; currentPassword?: string; newPassword?: string },
  ): Promise<Omit<User, 'password' | 'inviteToken'>> {
    const user = await this.repo.findOne({
      where: { id },
      select: ['id', 'email', 'name', 'role', 'isActive', 'password', 'inviteToken', 'createdAt', 'updatedAt'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (trimmed) user.name = trimmed;
    }

    if (data.newPassword) {
      if (!data.currentPassword) throw new BadRequestException('Mot de passe actuel requis');
      UserService.validatePasswordComplexity(data.newPassword);
      const valid = await bcrypt.compare(data.currentPassword, user.password ?? '');
      if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect');
      user.password = await bcrypt.hash(data.newPassword, 10);
    }

    const saved = await this.repo.save(user);
    const { password, inviteToken, ...safe } = saved as any;
    return safe;
  }

  static validatePasswordComplexity(password: string): void {
    if (password.length < 8)           throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères');
    if (!/[A-Z]/.test(password))       throw new BadRequestException('Le mot de passe doit contenir au moins une majuscule');
    if (!/[0-9]/.test(password))       throw new BadRequestException('Le mot de passe doit contenir au moins un chiffre');
  }

  async storeRefreshToken(id: string, hash: string): Promise<void> {
    await this.repo.update(id, { refreshTokenHash: hash } as any);
  }

  async clearRefreshToken(id: string): Promise<void> {
    await this.repo.update(id, { refreshTokenHash: null } as any);
  }

  findByRefreshTokenHash(hash: string) {
    return this.repo.findOne({
      where: { refreshTokenHash: hash } as any,
      select: ['id', 'email', 'name', 'role', 'isActive'],
    });
  }

  generateTempPassword(): string {
    const upper  = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const lower  = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const all    = upper + lower + digits;
    const rand   = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
    const chars  = [rand(upper), rand(digits), ...Array.from({ length: 10 }, () => rand(all))];
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  async resetPasswordById(id: string): Promise<string> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const tempPwd = this.generateTempPassword();
    user.password = await bcrypt.hash(tempPwd, 10);
    user.isActive = true;
    await this.repo.save(user);
    return tempPwd;
  }
}
