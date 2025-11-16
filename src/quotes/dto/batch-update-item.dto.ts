import { IsNumber, IsOptional, IsUUID, Allow } from 'class-validator';

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
  @Allow() // Permite que el valor sea 'null'
  margenPct1?: number | null;

  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct2?: number | null;

  // ... (Repite para margenPct3 hasta margenPct10) ...
  @IsNumber()
  @IsOptional()
  @Allow()
  margenPct10?: number | null;
}