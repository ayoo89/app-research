import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFiles, UploadedFile, Res, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/user.entity';
import { AdminService } from './admin.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { TaxonomyType } from '../taxonomy/taxonomy.entity';
import { IsEmail, IsString, MinLength, IsIn, IsOptional } from 'class-validator';

class InviteUserDto {
  @IsEmail() email: string;
  @IsString() name: string;
  @IsIn([UserRole.ADMIN, UserRole.USER]) role: UserRole;
}

class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() name: string;
  @IsIn([UserRole.ADMIN, UserRole.USER]) role: UserRole;
}

class TaxonomyDto {
  @IsIn(['category', 'family', 'subcategory']) type: TaxonomyType;
  @IsString() name: string;
  @IsOptional() @IsString() parentName?: string;
}

class TaxonomyUpdateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() parentName?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private taxonomyService: TaxonomyService,
  ) {}

  // ── Users ─────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  listUsers() { return this.adminService.listUsers(); }

  @Post('users')
  @ApiOperation({ summary: 'Create user with password — active immediately' })
  createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUserWithPassword(dto.email, dto.name, dto.role, dto.password);
  }

  @Post('users/invite')
  @ApiOperation({ summary: 'Invite user — sends email with generated credentials' })
  inviteUser(@Body() dto: InviteUserDto) {
    return this.adminService.inviteUser(dto.email, dto.name, dto.role);
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: 'Reset user password — sends new temporary credentials by email' })
  resetPassword(@Param('id') id: string) {
    return this.adminService.resetUserPassword(id);
  }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateUser(id, body);
  }

  @Delete('users/:id')
  removeUser(@Param('id') id: string) {
    return this.adminService.removeUser(id);
  }

  // ── Taxonomy ──────────────────────────────────────────────────────

  @Get('taxonomy')
  @ApiOperation({ summary: 'List taxonomy entries (category / family / subcategory)' })
  listTaxonomy(@Query('type') type?: TaxonomyType) {
    return this.taxonomyService.findAll(type);
  }

  @Post('taxonomy')
  @ApiOperation({ summary: 'Create a taxonomy entry' })
  createTaxonomy(@Body() dto: TaxonomyDto) {
    return this.taxonomyService.create(dto);
  }

  @Put('taxonomy/:id')
  @ApiOperation({ summary: 'Rename a taxonomy entry' })
  updateTaxonomy(@Param('id') id: string, @Body() dto: TaxonomyUpdateDto) {
    return this.taxonomyService.update(id, dto);
  }

  @Delete('taxonomy/:id')
  @ApiOperation({ summary: 'Delete a taxonomy entry' })
  removeTaxonomy(@Param('id') id: string) {
    return this.taxonomyService.remove(id);
  }

  // ── Product Import / Export ───────────────────────────────────────

  @Get('products/export/csv')
  @ApiOperation({ summary: 'Export all products as CSV file' })
  async exportCsv(@Res() res: Response) {
    const csv = await this.adminService.exportToCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
  }

  @Post('products/import/csv')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import products from CSV/Excel + optional images. strategy: "order" | "codegold"' })
  @UseInterceptors(FileFieldsInterceptor(
    [{ name: 'file', maxCount: 1 }, { name: 'images', maxCount: 200 }],
    { limits: { fileSize: 10 * 1024 * 1024 } },
  ))
  importCsv(
    @UploadedFiles() files: { file?: Express.Multer.File[]; images?: Express.Multer.File[] },
    @Body('strategy') strategy: string,
  ) {
    if (!files?.file?.[0]) throw new BadRequestException('No product file uploaded');
    const matchStrategy = strategy === 'order' ? 'order' : 'codegold';
    return this.adminService.importFromFile(files.file[0], files.images ?? [], matchStrategy);
  }
}
