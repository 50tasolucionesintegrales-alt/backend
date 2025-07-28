import { Transform } from 'class-transformer';
import { IsOptional, IsNumber, Min, IsInt } from 'class-validator';

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
    @IsInt({ message: 'La cantidad debe ser un entero' })
    @Min(1, { message: 'La cantidad mínima es 1' })
    cantidad?: number;
}
