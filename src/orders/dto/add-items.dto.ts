import { IsArray, ValidateNested, ArrayNotEmpty, IsInt, IsPositive, IsNumber, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

export class AddOrderItemDto {
    @IsDefined({ message: 'productId es requerido' })
    @Type(() => Number)
    @IsInt({ message: 'productId debe ser un entero válido' })
    @IsPositive({ message: 'productId debe ser mayor que 0' })
    productId!: number;

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

export class AddOrderItemsDto {
    @IsDefined({ message: 'items es requerido' })
    @IsArray({ message: 'items debe ser un arreglo' })
    @ArrayNotEmpty({ message: 'items no puede estar vacío' })
    @ValidateNested({ each: true, message: 'Cada elemento de items debe ser un objeto AddOrderItemDto válido' })
    @Type(() => AddOrderItemDto)
    items!: AddOrderItemDto[];
}
