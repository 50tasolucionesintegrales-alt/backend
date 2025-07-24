import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(
    private readonly maxSizeBytes = 2 * 1024 * 1024,     // 2MB
    private readonly allowedMimes = ['image/jpeg', 'image/png', 'image/webp'],
  ) {}

  transform(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');
    if (!this.allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no permitido');
    }
    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException('La imagen excede el tamaño permitido');
    }
    return file;
  }
}
