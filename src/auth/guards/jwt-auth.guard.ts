import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard sencillo que delega en la estrategia 'jwt'.
 * Si el token es válido, deja pasar la petición; de lo contrario responde 401.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
