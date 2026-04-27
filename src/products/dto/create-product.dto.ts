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
  @MaxLength(300, {
    message: 'La descripción debe tener máximo 300 caracteres',
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

  @IsOptional()
  @IsString({ message: 'El nombre de la tienda debe ser texto' })
  tienda_fisica: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto' })
  direccion: string;

  @IsOptional()
  @IsUrl({}, { message: 'El link de compra debe ser una URL válida' })
  link_compra2?: string;

  @IsOptional()
  @IsUrl({}, { message: 'El link de compra debe ser una URL válida' })
  link_compra3?: string;
}