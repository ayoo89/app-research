import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';
import { SuperAdminBootstrapService } from './super-admin-bootstrap.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserService, SuperAdminBootstrapService],
  exports: [UserService],
})
export class UserModule {}
