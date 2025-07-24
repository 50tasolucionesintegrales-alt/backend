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

  /**
   * Sube una imagen a Cloudinary (desde buffer de Multer).
   * folder: ej. 'products', 'evidences', 'avatars'
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    filename?: string,
  ): Promise<UploadApiResponse> {
    if (!file) throw new BadRequestException('Archivo no recibido');

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

  /**
   * Reemplaza una imagen:
   * 1) si hay url previa, la elimina
   * 2) sube la nueva
   */
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
}
