import { Controller, Post, Body, HttpCode, Get, Patch, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

class AcceptInviteDto {
  @IsString() token: string;
  @IsString() @MinLength(8) password: string;
}

class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() currentPassword?: string;
  @IsOptional() @IsString() @MinLength(8) newPassword?: string;
}

class ForgotPasswordDto {
  @IsEmail() email: string;
}

class RefreshDto {
  @IsString() refreshToken: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login — returns accessToken (2h) + refreshToken (30d)' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renew access token using refresh token (rotates refresh token)' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Invalidate refresh token' })
  async logout(@Req() req: any) {
    await this.authService.logout(req.user.id);
    return { message: 'Déconnecté' };
  }

  @Post('accept-invite')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept email invite and set password' })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto.token, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@Req() req: any) {
    const { password, inviteToken, refreshTokenHash, ...user } = req.user;
    return user;
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Update profile: name or password. Email cannot be changed.' })
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request password reset — notifies Super Admin. Always 200 (anti-enumeration).' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'Si cet e-mail est enregistré, le super administrateur a été notifié.' };
  }
}
