// quote-item-input.dto.ts
import { IsInt, Min, IsNumber, MinLength } from 'class-validator';

export class QuoteItemInput {
    @IsInt({ message: 'productId debe ser un número entero' })
    @Min(1, { message: 'productId debe ser mayor o igual a 1' })
    productId!: number;

    @IsInt({ message: 'La cantidad debe ser un entero' })
    @Min(1, { message: 'La cantidad mínima es 1' })
    cantidad!: number;

    @IsNumber({}, { message: 'El costo unitario debe ser un número' })
    @Min(0.01, { message: 'El costo unitario debe ser mayor a 0' })
    costoUnitario!: number;
}
