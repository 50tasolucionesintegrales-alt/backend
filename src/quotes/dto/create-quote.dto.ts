import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateQuoteDto {
    @IsIn(['productos', 'servicios'])
    tipo!: 'productos' | 'servicios';

    @IsString()
    @IsNotEmpty()
    @MaxLength(120, { message: 'El título no puede exceder 120 caracteres' })
    titulo!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500, { message: 'La descripción es muy larga (máx. 500)' })
    descripcion?: string;
}
