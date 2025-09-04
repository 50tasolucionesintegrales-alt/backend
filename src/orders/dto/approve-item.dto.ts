import { IsDefined, IsEnum, IsString, MaxLength, ValidateIf, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export enum ApproveStatusEnum {
    approved = 'approved',
    rejected = 'rejected',
}

export class ApproveItemDto {
    @IsDefined({ message: 'status es requerido' })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.toLowerCase().trim() : value,
    )
    @IsEnum(ApproveStatusEnum, {
        message: 'El status debe ser "approved" o "rejected"',
    })
    status!: ApproveStatusEnum;

    @ValidateIf((o) => o.status === ApproveStatusEnum.rejected)
    @IsDefined({ message: 'La razon es requerido cuando status es "rejected"' })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString({ message: 'reason debe ser texto' })
    @IsNotEmpty({ message: 'reason no puede estar vacío' })
    @MaxLength(300, { message: 'La razon no debe exceder 300 caracteres' })
    reason?: string;
}
