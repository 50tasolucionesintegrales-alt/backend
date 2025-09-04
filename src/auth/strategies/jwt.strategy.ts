// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import { AppJwtPayload } from 'src/common/utils/jwt.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,   // ← volvemos a inyectar
    cfg: ConfigService,
  ) {
    const secret = cfg.get<string>('JWT_SECRET');
    if (!secret) throw new Error('Falta JWT_SECRET en variables de entorno');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: AppJwtPayload) {
    // 1. obtenemos el rol real desde la BD (select ligero)
    const dbRol = await this.usersService.getRoleOnly(payload.sub);
    if (!dbRol) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // 2. si cambió el rol, invalida el token
    if (dbRol !== payload.rol) {
      throw new UnauthorizedException(
        'Roles desactualizados – vuelve a iniciar sesión',
      );
    }

    // 3. todo OK → req.user = payload
    return payload;
  }
}
