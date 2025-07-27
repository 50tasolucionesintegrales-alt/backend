import { IsBoolean } from 'class-validator';

export class SendQuoteDto {
    @IsBoolean({ message: 'confirm debe ser booleano' })
    confirm!: boolean;          // true para enviar definitivamente
}
