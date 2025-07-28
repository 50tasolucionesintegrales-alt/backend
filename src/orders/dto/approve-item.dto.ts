import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveItemDto {
    @IsEnum(['approved', 'rejected'])
    status!: 'approved' | 'rejected';

    @IsOptional() @IsString() @MaxLength(300)
    reason?: string;
}