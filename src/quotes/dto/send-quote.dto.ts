import { ArrayNotEmpty, IsArray, IsInt, Max, Min } from 'class-validator';

export class SendQuoteDto {
    @IsArray()
    @ArrayNotEmpty()
    empresas!: number[];
}
