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
import { IsEmail, IsString, IsEnum, IsOptional } from 'class-validator';

class InviteUserDto {
  @IsEmail() email: string;
  @IsString() name: string;
  @IsEnum(UserRole) role: UserRole;
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

  @Post('users/invite')
  @ApiOperation({ summary: 'Invite a new user via email' })
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
