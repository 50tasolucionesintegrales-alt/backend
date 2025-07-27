import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateOrderDto {
    @IsString() @IsNotEmpty() @MaxLength(120)
    titulo!: string;

    @IsOptional() @IsString() @MaxLength(500)
    descripcion?: string;
}
