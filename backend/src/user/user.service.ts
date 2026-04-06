import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email }, select: ['id', 'email', 'name', 'role', 'isActive', 'password'] });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findAll() {
    return this.repo.find({ select: ['id', 'email', 'name', 'role', 'isActive', 'createdAt'] });
  }

  async create(email: string, name: string, role: UserRole = UserRole.USER) {
    const inviteToken = uuidv4();
    const user = this.repo.create({ email, name, role, inviteToken, isActive: false });
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
