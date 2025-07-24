import { IsOptional, IsString, IsNumber, IsInt, MaxLength, Min, IsNotEmpty } from 'class-validator';

export class CreateServiceDto {
  @IsNotEmpty({ message: 'El nombre no puede ir vacio' })
  @IsString({ message: 'El nombre debe ser texto' })
  nombre!: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  descripcion?: string;

  @IsOptional()
  @IsString({ message: 'El precio base debe ser un número válido (decimal como string)' })
  precioBase?: string;

  @IsOptional()
  @IsInt({ message: 'La duración debe ser un entero (minutos)' })
  @Min(1, { message: 'La duración debe ser mayor a 0' })
  duracionMinutos?: number;
}
