import {IsArray, ValidateNested, ArrayNotEmpty, IsEnum, IsInt, IsPositive, IsNumber, IsDefined, ValidateIf } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum ItemType {
    producto = 'producto',
    servicio = 'servicio',
}

export class AddItemDto {
    @IsDefined({ message: 'tipo es requerido' })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.toLowerCase().trim() : value,
    )
    @IsEnum(ItemType, { message: 'tipo debe ser "producto" o "servicio"' })
    tipo!: ItemType;

    @ValidateIf((o) => o.tipo === ItemType.producto)
    @IsDefined({ message: 'productId es requerido cuando tipo es "producto"' })
    @Type(() => Number)
    @IsInt({ message: 'productId debe ser un entero válido' })
    @IsPositive({ message: 'productId debe ser mayor que 0' })
    productId?: number;

    @ValidateIf((o) => o.tipo === ItemType.servicio)
    @IsDefined({ message: 'serviceId es requerido cuando tipo es "servicio"' })
    @Type(() => Number)
    @IsInt({ message: 'serviceId debe ser un entero válido' })
    @IsPositive({ message: 'serviceId debe ser mayor que 0' })
    serviceId?: number;

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

export class AddItemsDto {
    @IsDefined({ message: 'items es requerido' })
    @IsArray({ message: 'items debe ser un arreglo' })
    @ArrayNotEmpty({ message: 'items no puede estar vacío' })
    @ValidateNested({ each: true, message: 'Cada elemento de items debe ser un AddItemDto válido' })
    @Type(() => AddItemDto) // convierte elementos a AddItemDto
    items!: AddItemDto[];
}
