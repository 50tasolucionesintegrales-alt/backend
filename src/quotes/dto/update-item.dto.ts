import { Transform } from 'class-transformer';
import { IsOptional, IsNumber, Min, IsInt, IsString, MaxLength } from 'class-validator';

const toNum = () =>
    Transform(({ value }) => {
        if (value === null || value === undefined || value === '') return undefined;
        // Normaliza formatos como "1.234,56" o "1,234.56"
        let s = String(value).trim();
        if (s.match(/,\d{1,2}$/)) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
        return parseFloat(s);
    });

export class UpdateItemDto {
    @IsOptional()
    @IsNumber({}, { message: 'margenPct1 debe ser un número' })
    @Min(0, { message: 'margenPct1 no puede ser negativo' })
    margenPct1?: number;

    @IsOptional()
    @IsNumber({}, { message: 'margenPct2 debe ser un número' })
    @Min(0, { message: 'margenPct2 no puede ser negativo' })
    margenPct2?: number;

    @IsOptional()
    @IsNumber({}, { message: 'margenPct3 debe ser un número' })
    @Min(0, { message: 'margenPct3 no puede ser negativo' })
    margenPct3?: number;

    @IsOptional()
    @IsNumber({}, { message: 'margenPct4 debe ser un número' })
    @Min(0, { message: 'margenPct4 no puede ser negativo' })
    margenPct4?: number;

    @IsOptional()
    @IsNumber({}, { message: 'margenPct5 dede ser negativo' })
    @Min(0, { message: 'margenPct5 no puede ser negativo' })
    margenPct5?: number;

    @IsOptional()
    @IsNumber({}, { message: 'margenPct6 debe ser un número' })
    @Min(0, { message: 'margenPct6 no puede ser negativo' })
    margenPct6?: number;

    @IsOptional()
    @IsNumber({}, { message: 'margenPct7 debe ser un número' })
    @Min(0, { message: 'margenPct7 no puede ser negativo' })
    margenPct7?: number;

    @IsOptional()
    @IsInt({ message: 'La cantidad debe ser un entero' })
    @Min(1, { message: 'La cantidad mínima es 1' })
    cantidad?: number;

    @IsOptional()
    @IsString()
    @MaxLength(120, { message: 'El texto no puede exceder 120 caracteres' })
    unidad?: string;
}
