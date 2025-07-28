import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { CLOUDINARY } from './cloudinary.constants';
import { v2 as Cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { extractPublicId } from 'src/common/utils/extract-public-id.util';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof Cloudinary,
  ) { }

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    filename?: string,
    maxBytes = 5 * 1024 * 1024,                     // 5 MB
    allowed = ['image/jpeg', 'image/png', 'image/webp'],
  ): Promise<UploadApiResponse> {
    if (!file) throw new BadRequestException('Archivo no recibido');

    if (!allowed.includes(file.mimetype))
      throw new BadRequestException('Formato no permitido (solo JPG/PNG/WebP)');

    if (file.size > maxBytes)
      throw new BadRequestException(`Máximo ${maxBytes / 1_048_576} MB`);

    const stream = Readable.from(file.buffer);
    const options: any = {
      folder,
      resource_type: 'image',
      // Si quieres forzar el nombre:
      ...(filename && { public_id: filename }),
      overwrite: true,
    };

    return new Promise((resolve, reject) => {
      const upload = this.cloudinary.uploader.upload_stream(
        options,
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
      stream.pipe(upload);
    });
  }

  async uploadBuffer(
    bufferOrStream: Buffer | Readable,
    folder: string,
    filename: string,
  ): Promise<UploadApiResponse> {
    const stream =
      bufferOrStream instanceof Readable
        ? bufferOrStream
        : Readable.from(bufferOrStream);

    return new Promise((resolve, reject) => {
      const upload = this.cloudinary.uploader.upload_stream(
        {
          folder,
          format: 'pdf',
          public_id: filename,
          resource_type: 'raw', // ← necesario para PDF
          overwrite: true,
        },
        (err: UploadApiErrorResponse, res: UploadApiResponse) =>
          err ? reject(err) : resolve(res),
      );
      stream.pipe(upload);
    });
  }

  generateSignedPdfUrl(
    publicId: string,            // "quotes/quote_1_m1"  (sin .pdf)
    ttlSeconds = 3600,           // caduca en 1 h
  ): string {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;

    return this.cloudinary.utils.private_download_url(
      publicId,                  // id sin extensión
      'pdf',                     // formato
      {
        type: 'upload',          // siempre que subas con type "default"
        resource_type: 'raw',    // ← importante
        expires_at: expires,     // época Unix
      },
    );
  }

  /** Elimina por publicId */
  async deleteByPublicId(publicId: string) {
    return this.cloudinary.uploader.destroy(publicId, { invalidate: true });
  }

  /** Elimina por URL (extrae publicId) */
  async deleteByUrl(url: string) {
    const publicId = extractPublicId(url);
    if (!publicId) throw new BadRequestException('URL de Cloudinary inválida');
    return this.deleteByPublicId(publicId);
  }

  async replaceImage(
    oldUrl: string | null,
    newFile: Express.Multer.File,
    folder: string,
    filename?: string,
  ) {
    if (oldUrl) {
      try {
        await this.deleteByUrl(oldUrl);
      } catch {
        // No interrumpir si falla la eliminación
      }
    }
    return this.uploadImage(newFile, folder, filename);
  }

  async deleteRawByPublicId(publicId: string) {
    return this.cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: 'raw',      // ← indispensable para PDF
    });
  }
}
