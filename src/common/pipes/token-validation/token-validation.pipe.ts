import {  BadRequestException, Injectable,PipeTransform,} from '@nestjs/common';

@Injectable()
export class TokenValidationPipe implements PipeTransform<string, string> {
  private readonly regex = /^\d{6}$/;          // exactamente 6 dígitos

  transform(value: string): string {
    if (!this.regex.test(value)) {
      throw new BadRequestException('Token no válido');
    }
    return value;                              // pasa como string
  }
}
