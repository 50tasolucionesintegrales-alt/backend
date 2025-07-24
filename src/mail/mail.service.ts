import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transporter } from 'nodemailer';
import { MAILER_TRANSPORT } from './constants';

export interface EmailPayload {
  nombre: string;
  email: string;
  token: string;
}

@Injectable()
export class MailService {
  constructor(
    @Inject(MAILER_TRANSPORT) private readonly transporter: Transporter,
    private readonly config: ConfigService,
  ) {}

    async sendConfirmationEmail({ nombre, email, token }: EmailPayload) {
        await this.transporter.sendMail({
            from: `50ta <${this.config.get('GMAIL_USER')}>`,
            to: email,
            subject: '50ta – Confirma tu cuenta',
            html: `
        <p>Hola ${nombre}, has creado tu cuenta en 50ta, ya casi está lista.</p>
        <p>Visita el siguiente enlace:</p>
        <a href="${this.config.get('FRONTEND_URL')}/auth/confirm-account">Confirmar cuenta</a>
        <p>e ingresa el código: <b>${token}</b></p>
        `,
    });
  }

    async sendPasswordResetToken({ nombre, email, token }: EmailPayload) {
        await this.transporter.sendMail({
            from: `50ta <${this.config.get('GMAIL_USER')}>`,
            to: email,
            subject: '50ta – Restablece tu contraseña',
            html: `
        <p>Hola ${nombre}, has solicitado restablecer tu contraseña.</p>
        <p>Visita el siguiente enlace:</p>
        <a href="${this.config.get('FRONTEND_URL')}/auth/new-password">Restablecer contraseña</a>
        <p>e ingresa el código: <b>${token}</b></p>
        `,
    });
  }
}
