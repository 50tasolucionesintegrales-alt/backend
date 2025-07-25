// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AppJwtPayload } from 'src/common/utils/jwt.util';   // ← interfaz con sub, rol, email, nombre

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    const secret = cfg.get<string>('JWT_SECRET');
    if (!secret) throw new Error('Falta JWT_SECRET en variables de entorno');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      algorithms: ['HS256'],        // mismo algoritmo que usas al firmar
    });
  }

  /**
   * Passport llama a validate() si la firma es correcta.
   * Simplemente devolvemos el payload; estará disponible en req.user.
   */
  async validate(payload: AppJwtPayload) {
    return payload;                 // { sub, rol, email, nombre, iat, exp }
  }
}
