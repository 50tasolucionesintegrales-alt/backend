import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';


@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any, info: any, ctx: any) {
        const req = ctx.switchToHttp().getRequest();

        if (err || !user) {
            // Puedes inspeccionar `info?.name` para mensajes más específicos
            if (info?.name === 'TokenExpiredError') {
                throw new UnauthorizedException('El token ha expirado, inicie sesión nuevamente');
            }
            throw new UnauthorizedException('Token no válido o inexistente'); // ← tu nuevo mensaje
        }
        return user;
    }
}
