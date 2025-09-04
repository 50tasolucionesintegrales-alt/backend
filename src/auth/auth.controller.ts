// src/auth/auth.controller.ts
import { Controller, Post, Body, UsePipes, ValidationPipe, Req } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

@UsePipes(new ValidationPipe({ transform: true }))
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Req() req, @Body() dto: LoginDto) {
    const ua = (req.headers['user-agent'] as string) || undefined;
    const ip = (req.ip as string) || undefined;
    return this.auth.login(dto, ip, ua);
  }
}
