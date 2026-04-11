import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    let user = await this.repo.findOne({
      where: { email: normalized },
      select: ['id', 'email', 'name', 'role', 'isActive', 'password', 'inviteToken'],
    });
    if (!user) {
      user = this.repo.create({
        email: normalized,
        name: 'Super Admin',
        password: hash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        inviteToken: null,
      });
      return this.repo.save(user);
    }
    user.role = UserRole.SUPER_ADMIN;
    user.password = hash;
    user.isActive = true;
    user.inviteToken = null;
    if (!user.name) user.name = 'Super Admin';
    return this.repo.save(user);
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
    if (plainPassword.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères');
    }
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
    return this.repo.save(user);
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
}
