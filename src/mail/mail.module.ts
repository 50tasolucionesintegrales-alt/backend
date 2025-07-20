import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { mailerConfig } from '../config/mailer.config';
import { MAILER_TRANSPORT } from './constants';
import { MailService } from './mail.service';

@Module({
  imports: [ConfigModule],               // ya es global, pero explícito
  providers: [
    {
      provide: MAILER_TRANSPORT,
      inject: [ConfigService],
      useFactory: mailerConfig,          // delega a /config
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
