import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly usersService: UsersService,
        cfg: ConfigService,
    ) {
        const secret = cfg.get('JWT_SECRET');
        if (!secret) throw new Error('Falta JWT_SECRET en variables de entorno');

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: secret as string,          // ya garantizamos que no es undefined
        });
    }

    async validate(payload: { sub: string }) {
        const user = await this.usersService.findOne(payload.sub);
        if (!user) throw new UnauthorizedException('Token sin usuario válido');
        return user;                              // será req.user
    }
}
