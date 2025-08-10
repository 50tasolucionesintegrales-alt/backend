import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthEventsService } from './auth-events.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserLoginLog } from './entities/user-login-log.entity';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserLoginLog,User]),UsersModule, ConfigModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthEventsService],
  exports: [AuthService, AuthEventsService],
})
export class AuthModule {}
