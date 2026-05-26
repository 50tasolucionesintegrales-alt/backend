import { IsString, IsNumber, IsArray, ValidateNested, IsOptional, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SubconceptoDto {
  @IsString()
  itemId!: string;

  @IsOptional()
  @IsString()
  marca?: string;
}

export class ConceptoDto {
  @IsNumber()
  @Min(1)
  concepto!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubconceptoDto)
  subconceptos!: SubconceptoDto[];
}

export class GenerateLicitacionPdfDto {
  @IsNumber()
  @Min(1)
  @Max(12)
  empresa!: number;

  @IsIn(['tecnica', 'economica'])
  tipo!: 'tecnica' | 'economica';

  @IsString()
  sufijoLicitacion!: string;

  @IsString()
  tituloLicitacion!: string;

  @IsOptional()
  @IsString()
  documentoVI?: string;

  @IsString()
  fecha!: string;

  @IsOptional()
  @IsString()
  lugar?: string;

  /* Destinatario */
  @IsString()
  destinatario!: string;

  /* Nombre del licitante */
  @IsString()
  nombreLicitante!: string;

  /* Firmante */
  @IsOptional()
  @IsString()
  firmanteNombre?: string;

  @IsOptional()
  @IsString()
  firmanteCargo?: string;

  /* Agrupación de ítems */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConceptoDto)
  grupos!: ConceptoDto[];
}