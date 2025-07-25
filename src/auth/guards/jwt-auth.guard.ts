import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';


@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any, info: any, ctx: any) {
        const req = ctx.switchToHttp().getRequest();

        console.log('→ RolesGuard | req.user.rol =', req.user?.rol);   // DEBUG


        if (err || !user) {
            // Puedes inspeccionar `info?.name` para mensajes más específicos
            if (info?.name === 'TokenExpiredError') {
                throw new UnauthorizedException('El token ha expirado');
            }
            throw new UnauthorizedException('Token no válido o inexistente'); // ← tu nuevo mensaje
        }
        return user;
    }
}
