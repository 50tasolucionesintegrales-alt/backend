import { IsDefined, IsInt, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateItemsDto {
    @IsDefined({ message: 'cantidad es requerida' })
    @Type(() => Number)
    @IsInt({ message: 'cantidad debe ser un entero válido' })
    @IsPositive({ message: 'cantidad debe ser mayor que 0' })
    cantidad!: number;

    @IsDefined({ message: 'costoUnitario es requerido' })
    @Type(() => Number)
    @IsNumber(
        { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
        { message: 'costoUnitario debe ser un número válido con máximo 2 decimales' },
    )
    @IsPositive({ message: 'costoUnitario debe ser mayor que 0' })
    costoUnitario!: number;
}
