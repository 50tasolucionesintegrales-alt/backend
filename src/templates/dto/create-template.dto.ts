import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateTemplateDto {
  @IsNotEmpty()
  @IsString()
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  archivo?: Buffer;
}