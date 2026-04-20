import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/user.entity';
import { HierarchyService } from './hierarchy.service';

class FamilyDto {
  @IsString() name: string;
}

class SubFamilyDto {
  @IsString() name: string;
  @IsString() familyId: string;
}

class SubFamilyUpdateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() familyId?: string;
}

class CategoryDto {
  @IsString() name: string;
  @IsString() subFamilyId: string;
}

class CategoryUpdateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() subFamilyId?: string;
}

@ApiTags('hierarchy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class HierarchyController {
  constructor(private service: HierarchyService) {}

  // ── Families ──────────────────────────────────────────────────────

  @Get('families')
  @ApiOperation({ summary: 'List families with sub-family count' })
  listFamilies() { return this.service.listFamilies(); }

  @Post('families')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  createFamily(@Body() dto: FamilyDto) {
    return this.service.createFamily(dto.name);
  }

  @Put('families/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  updateFamily(@Param('id') id: string, @Body() dto: FamilyDto) {
    return this.service.updateFamily(id, dto.name);
  }

  @Delete('families/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  removeFamily(@Param('id') id: string) {
    return this.service.removeFamily(id);
  }

  // ── Sub-Families ──────────────────────────────────────────────────

  @Get('sub-families')
  @ApiOperation({ summary: 'List sub-families with category count' })
  listSubFamilies(@Query('familyId') familyId?: string) {
    return this.service.listSubFamilies(familyId);
  }

  @Post('sub-families')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  createSubFamily(@Body() dto: SubFamilyDto) {
    return this.service.createSubFamily(dto.name, dto.familyId);
  }

  @Put('sub-families/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  updateSubFamily(@Param('id') id: string, @Body() dto: SubFamilyUpdateDto) {
    return this.service.updateSubFamily(id, dto);
  }

  @Delete('sub-families/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  removeSubFamily(@Param('id') id: string) {
    return this.service.removeSubFamily(id);
  }

  // ── Categories ────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'List categories with product count' })
  listCategories(@Query('subFamilyId') subFamilyId?: string) {
    return this.service.listCategories(subFamilyId);
  }

  @Post('categories')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  createCategory(@Body() dto: CategoryDto) {
    return this.service.createCategory(dto.name, dto.subFamilyId);
  }

  @Put('categories/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  updateCategory(@Param('id') id: string, @Body() dto: CategoryUpdateDto) {
    return this.service.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  removeCategory(@Param('id') id: string) {
    return this.service.removeCategory(id);
  }
}
