import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

export interface FileValidationOptions {
  required?: boolean;
  maxSizeBytes?: number;
  allowedMimes?: string[];
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(
    private readonly opts: FileValidationOptions = {},
  ) { }

  transform(file: Express.Multer.File) {
    const {
      required = true,
      maxSizeBytes = 2 * 1024 * 1024, // 2MB
      allowedMimes = ['image/jpeg', 'image/png', 'image/webp'],
    } = this.opts;

    if (!file) {
      if (required) throw new BadRequestException('Archivo requerido');
      return undefined;
    }

    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no permitido');
    }

    if (file.size > maxSizeBytes) {
      throw new BadRequestException('La imagen excede el tamaño permitido');
    }

    return file;
  }
}
