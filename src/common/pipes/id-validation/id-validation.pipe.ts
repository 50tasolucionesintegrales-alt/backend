import { BadRequestException, Injectable, ParseIntPipe} from '@nestjs/common';

@Injectable()
export class IdValidationPipe extends ParseIntPipe {
  constructor() {
    super({
      exceptionFactory: () => new BadRequestException('ID inválido'),
    });
  }
}
