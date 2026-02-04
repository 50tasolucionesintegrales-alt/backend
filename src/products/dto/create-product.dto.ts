import {
  IsString,
  IsNumberString,
  IsOptional,
  IsUrl,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';

export class CreateProductDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(255)
  nombre!: string;

  @IsString({ message: 'La descripción debe ser texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(128, {
    message: 'La descripción debe tener máximo 128 caracteres',
  })
  descripcion!: string;

  @IsNumberString({}, { message: 'El precio debe ser un número válido' })
  precio!: string;

  @IsOptional()
  especificaciones?: Record<string, any>;

  @IsOptional()
  @IsUrl({}, { message: 'El link de compra debe ser una URL válida' })
  link_compra?: string;

  @IsString({ message: 'El ID de categoría es obligatorio' })
  categoryId!: string;
}