import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserLoginLog } from './entities/user-login-log.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class AuthEventsService {
    constructor(
        @InjectRepository(UserLoginLog) private logsRepo: Repository<UserLoginLog>,
        @InjectRepository(User) private usersRepo: Repository<User>,
    ) { }

    async logSuccess(user: User, ip?: string, ua?: string) {
        await this.logsRepo.save(this.logsRepo.create({
            user, success: true, ip: ip ?? null, userAgent: ua ?? null,
        }));

        // (Opcional) mantener contador y lastLoginAt en users
        // user.loginCount = (user as any).loginCount ? (user as any).loginCount + 1 : 1;
        // user.lastLoginAt = new Date();
        // await this.usersRepo.save(user);
    }

    async logFailure(email: string | null, ip?: string, ua?: string) {
        await this.logsRepo.save(this.logsRepo.create({
            emailIntent: email ?? null, success: false, ip: ip ?? null, userAgent: ua ?? null,
        }));
    }
}
