import {
  Controller, Get, Post, Put, Delete, Param, Body,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/user.entity';
import { AdminService } from './admin.service';
import { IsEmail, IsString, MinLength, IsIn } from 'class-validator';

class InviteUserDto {
  @IsEmail() email: string;
  @IsString() name: string;
  @IsIn([UserRole.ADMIN, UserRole.USER])
  role: UserRole;
}

class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() name: string;
  @IsIn([UserRole.ADMIN, UserRole.USER])
  role: UserRole;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // Users
  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  listUsers() { return this.adminService.listUsers(); }

  @Post('users')
  @ApiOperation({
    summary: 'Créer un utilisateur (e-mail + mot de passe)',
    description: 'Compte actif immédiatement. Rôle : admin ou user uniquement. Réservé au super administrateur.',
  })
  createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUserWithPassword(dto.email, dto.name, dto.role, dto.password);
  }

  @Post('users/invite')
  @ApiOperation({ summary: 'Inviter un utilisateur par e-mail (lien d’activation)' })
  inviteUser(@Body() dto: InviteUserDto) {
    return this.adminService.inviteUser(dto.email, dto.name, dto.role);
  }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateUser(id, body);
  }

  @Delete('users/:id')
  removeUser(@Param('id') id: string) {
    return this.adminService.removeUser(id);
  }

  // Product Import
  @Post('products/import/csv')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import products from CSV file' })
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@UploadedFile() file: Express.Multer.File) {
    return this.adminService.importFromCsv(file.buffer);
  }
}
