import { Transform } from 'class-transformer';
import { IsOptional, IsNumber, Min, IsInt, IsString, MaxLength } from 'class-validator';

const toNum = () =>
  Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    let s = String(value).trim();
    if (s.match(/,\d{1,2}$/)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
  });

export class UpdateItemDto {
  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct1 debe ser un número' })
  margenPct1?: number;

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct2 debe ser un número' })
  margenPct2?: number;

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct3 debe ser un número' })
  margenPct3?: number;

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct4 debe ser un número' })
  margenPct4?: number;

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct5 debe ser un número' })
  margenPct5?: number;

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct6 debe ser un número' })
  margenPct6?: number;

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct7 debe ser un número' })
  margenPct7?: number;

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct8 debe ser un número' })
  margenPct8?: number;

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct9 debe ser un número' })
  margenPct9?: number;

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct10 debe ser un número' })
  margenPct10?: number;

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct11 debe ser un número' })
  margenPct11?: number;  

  @IsOptional() @toNum() @IsNumber({}, { message: 'margenPct12 debe ser un número' })
  margenPct12?: number;

  @IsOptional()
  @IsInt({ message: 'La cantidad debe ser un entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidad?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'El texto no puede exceder 120 caracteres' })
  unidad?: string;
}
