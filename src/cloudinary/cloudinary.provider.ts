import { ConfigService } from '@nestjs/config';
import { v2 as Cloudinary } from 'cloudinary';
import { CLOUDINARY } from './cloudinary.constants';

export const CloudinaryProvider = {
    provide: CLOUDINARY,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
        Cloudinary.config({
            cloud_name: config.get<string>('CLOUDINARY_CLOUD_NAME'),
            api_key: config.get<string>('CLOUDINARY_API_KEY'),
            api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
            secure: config.get<boolean>('CLOUDINARY_SECURE') ?? true,
        });
        return Cloudinary;
    },
};
