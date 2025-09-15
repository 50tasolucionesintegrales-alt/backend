import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { MailService } from 'src/mail/mail.service';
import { ValidateTokenDto } from './dto/validate-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset.password.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/common/enums/roles.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';
import { IdValidationPipe } from 'src/common/pipes/id-validation/id-validation.pipe';
import { TokenValidationPipe } from 'src/common/pipes/token-validation/token-validation.pipe';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
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

  /* ---------- Forgot password ---------- */
  @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.usersService.forgotPassword(dto.email);
  }

  /* ---------- Validar token de reset ---------- */
  @Post('validate-reset-token')
  validateReset(@Body('token', TokenValidationPipe) token: string) {
    return this.usersService.validateResetToken(token);
  }

  /* ---------- Resetear contraseña con token ---------- */
  @Post('reset-password/:token')
  reset(
    @Param('token', TokenValidationPipe) token: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(token, dto.password);
  }

  /* ---------- Cambiar contraseña autenticado ---------- */
  @UseGuards(JwtAuthGuard)
  @Patch('update-password')
  updatePassword(
    @Req() req,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(
      req.user.id,
      dto.current_password,
      dto.password,
    );
  }

  /* ---------- Verificar contraseña autenticado ---------- */
  @UseGuards(JwtAuthGuard)
  @Post('check-password')
  checkPassword(@Req() req, @Body('password') password: string) {
    return this.usersService.checkPassword(req.user.id, password);
  }

}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/users')            // prefijo claro
export class AdminUsersController {
  constructor(private readonly users: UsersService) { }

  /** Confirmados pero sin rol */
  @Get('unassigned')
  @Roles(Role.Admin)
  findUnassigned() {
    return this.users.findConfirmedUnassigned();
  }

  /** Confirmados con rol cotizador o comprador */
  @Get('with-role')
  @Roles(Role.Admin)
  findWithRole() {
    return this.users.findConfirmedWithRoles();
  }

  /** Asignar / cambiar rol (solo cotizador | comprador) */
  @Patch(':id/role')
  @Roles(Role.Admin)
  updateRole(
    @Param('id', IdValidationPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.users.setRole(id, dto.rol);
  }

  /** Eliminar usuario (no admin) */
  @Delete(':id')
  @Roles(Role.Admin)
  deleteUser(@Param('id', IdValidationPipe) id: string) {
    return this.users.deleteUser(id);
  }
}