import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from 'src/mail/mail.service';
import { ValidateTokenDto } from './dto/validate-token.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset.password.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/common/enums/roles.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';
import { IdValidationPipe } from 'src/common/pipes/id-validation/id-validation.pipe';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService
  ) { }

  @Post('register')
  async register(@Body() dto: CreateUserDto) {
    const user = await this.usersService.register(dto);

    await this.mailService.sendConfirmationEmail({
      nombre: user.nombre,
      email: user.email,
      token: user.token!,
    });

    return { message: 'Registro creado, revisa tu correo' };
  }

  /* ---------- Confirmar cuenta ---------- */
  @Post('confirm-account')
  confirm(@Body() dto: ValidateTokenDto) {
    return this.usersService.confirmAccount(dto.token);
  }

}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users/admin')            // prefijo claro
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(Role.Admin)                  // solo admin autenticado
  findAllConfirmed() {
    return this.users.findConfirmedUnassigned();
  }

  @Patch(':id/role')
  @Roles(Role.Admin)
  updateRole(@Param('id', IdValidationPipe) id:string, @Body() dto: UpdateRoleDto) {
    return this.users.setRole(id, dto.rol);
  }
}
