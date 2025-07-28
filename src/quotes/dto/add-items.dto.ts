import { IsArray, ValidateNested, ArrayNotEmpty, IsEnum, IsInt, IsPositive, IsNumber, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class AddItemDto {
    @IsEnum(['producto', 'servicio'])
    tipo!: 'producto' | 'servicio';

    @ValidateIf((o) => o.tipo === 'producto')
    @IsInt() @IsPositive()
    productId?: number;

    @ValidateIf((o) => o.tipo === 'servicio')
    @IsInt() @IsPositive()
    serviceId?: number;

    @IsInt() @IsPositive()
    cantidad!: number;

    @IsNumber() @IsPositive()
    costoUnitario!: number;
}

export class AddItemsDto {
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => AddItemDto)           // 👈 convierte a AddItemDto[]
    items!: AddItemDto[];
}
