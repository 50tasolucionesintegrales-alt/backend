import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(ctx: ExecutionContext): boolean {
        const allowed = this.reflector.get<string[]>('roles', ctx.getHandler()) ?? [];
        if (!allowed.length) return true;          // ruta sin restricción extra
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;                 // colocado por JwtStrategy
        return allowed.includes(user?.rol);
    }
}
