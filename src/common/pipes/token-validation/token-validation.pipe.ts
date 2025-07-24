import { BadRequestException, Injectable, ParseIntPipe } from '@nestjs/common';

@Injectable()
export class TokenValidationPipe extends ParseIntPipe {
  constructor() {
    super({
      exceptionFactory: () => new BadRequestException('Token no válido'),
    });
  }
}
