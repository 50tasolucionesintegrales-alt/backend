import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { checkPassword } from '../common/utils/crypto.util';
import { LoginDto } from './dto/login.dto';
import { generateJWT } from 'src/common/utils/jwt.util';
import { Role } from 'src/common/enums/roles.enum';
import { AuthEventsService } from './auth-events.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly authEvents: AuthEventsService
  ) { }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      await this.authEvents.logFailure(dto.email, ip, userAgent);
      throw new NotFoundException('El e-mail no existe');
    }

    if (!user.confirmed) {
      await this.authEvents.logFailure(dto.email, ip, userAgent);
      throw new ForbiddenException('Cuenta no confirmada');
    }

    const ok = await checkPassword(dto.password, user.password);
    if (!ok) {
      await this.authEvents.logFailure(dto.email, ip, userAgent);
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    if (user.rol === Role.Unassigned) {
      await this.authEvents.logFailure(dto.email, ip, userAgent);
      throw new ForbiddenException('Rol pendiente de asignación');
    }

    const token = generateJWT({
      sub: user.id,
      rol: user.rol,
      nombre: user.nombre,
      email: user.email,
    });

    // ✅ Log de éxito
    await this.authEvents.logSuccess(user, ip, userAgent);

    return {
      message: 'Autenticado...',
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
    };
  }
}
