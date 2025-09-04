import { IsDefined, IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOrderDto {
    @IsDefined({ message: 'titulo es requerido' })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString({ message: 'titulo debe ser texto' })
    @IsNotEmpty({ message: 'titulo no puede estar vacío' })
    @MaxLength(120, { message: 'El titulo no debe exceder 120 caracteres' })
    titulo!: string;

    @IsOptional()
    @Transform(({ value }) =>
        typeof value === 'string' ? (value.trim() || undefined) : value,
    )
    @IsString({ message: 'descripcion debe ser texto' })
    @MaxLength(500, { message: 'La descripcion no debe exceder 500 caracteres' })
    descripcion?: string;
}
