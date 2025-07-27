import {
    IsArray, ValidateNested, ArrayNotEmpty,
    IsInt, IsPositive, IsNumber
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddOrderItemDto {
    @IsInt() @IsPositive()
    productId!: number;

    @IsInt() @IsPositive()
    cantidad!: number;

    @IsNumber() @IsPositive()
    costoUnitario!: number;
}

export class AddOrderItemsDto {
    @IsArray() @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => AddOrderItemDto)
    items!: AddOrderItemDto[];
}
