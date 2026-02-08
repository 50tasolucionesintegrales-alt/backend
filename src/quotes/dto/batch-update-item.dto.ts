import { IsNumber, IsOptional, IsUUID, Allow, isNumber } from 'class-validator';

// Este DTO solo define los campos que se pueden cambiar desde la tabla
export class BatchUpdateItemDto {
  @IsUUID()
  id: string; // <-- El ID del ítem a modificar

  @IsNumber()
  @IsOptional()
  cantidad?: number;

  @IsNumber()
  @IsOptional()
  costo_unitario?: number;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct1?: number | null;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct2?: number | null;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct3?: number | null;
  
  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct4?: number | null;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct5?: number | null;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct6?: number | null;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct7?: number | null;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct8?: number | null;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct9?: number | null;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct10?: number | null;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct11?: number | null;
}