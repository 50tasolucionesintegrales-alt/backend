import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, Max, Min } from 'class-validator';

export class ImportExcelDto {
  @IsArray({ message: 'empresas debe ser un arreglo' })
  @ArrayNotEmpty({ message: 'Debes seleccionar al menos una empresa' })
  @IsInt({ each: true, message: 'Cada empresa debe ser un número entero' })
  @Min(1, { each: true, message: 'El número de empresa debe ser mínimo 1' })
  @Max(12, { each: true, message: 'El número de empresa debe ser máximo 12' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    return value;
  })
  empresas!: number[];
}
