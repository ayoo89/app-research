import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UserService } from './user.service';
import { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from '../auth/super-admin.constants';

@Injectable()
export class SuperAdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SuperAdminBootstrapService.name);

  constructor(private readonly userService: UserService) {}

  async onModuleInit() {
    await this.userService.ensureSuperAdmin(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    this.logger.log(`Super admin synchronisé : ${SUPER_ADMIN_EMAIL.toLowerCase()}`);
  }
}
