import * as jwt from 'jsonwebtoken';
import { JwtPayload, Secret } from 'jsonwebtoken';

export const generateJWT = (payload: JwtPayload) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Falta la variable de entorno JWT_SECRET');
  }

  return jwt.sign(payload, secret as Secret, { expiresIn: '180d' });
};
