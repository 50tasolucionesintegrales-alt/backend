// src/common/utils/jwt.util.ts
import * as jwt from 'jsonwebtoken';
import { Secret } from 'jsonwebtoken';
import { Role } from '../enums/roles.enum';

/** Payload que grabaremos dentro del JWT */
export interface AppJwtPayload extends jwt.JwtPayload {
  sub: string;     // id del usuario
  rol: Role;       // admin | cotizador | comprador | unassigned
  email: string;
  nombre: string;
}

export function generateJWT(payload: AppJwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta la variable de entorno JWT_SECRET');

  return jwt.sign(payload, secret as Secret, {
    expiresIn: '2h',     // o el tiempo que prefieras
    algorithm: 'HS256',
  });
}
