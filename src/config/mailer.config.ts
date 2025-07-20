import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export const mailerConfig = (config: ConfigService): Transporter => {
    return createTransport({
        service: 'gmail',
        auth: {
            user: config.get<string>('GMAIL_USER'),
            pass: config.get<string>('GMAIL_PASS'),
        },
    });
};
