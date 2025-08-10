import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export enum MetricsPreset {
    LAST_7D = 'last_7d',
    LAST_30D = 'last_30d',
    THIS_MONTH = 'this_month',
    LAST_MONTH = 'last_month',
    YTD = 'year_to_date',
    CUSTOM = 'custom',
    ALL_TIME = 'all_time',
}

export class RangeQueryDto {
    @IsOptional()
    @IsEnum(MetricsPreset, { message: 'preset inválido' })
    preset?: MetricsPreset;

    @ValidateIf((o) => (o.preset ?? MetricsPreset.LAST_30D) === MetricsPreset.CUSTOM)
    @IsISO8601({}, { message: 'desde debe ser una fecha válida (YYYY-MM-DD)' })
    desde?: string;

    @ValidateIf((o) => (o.preset ?? MetricsPreset.LAST_30D) === MetricsPreset.CUSTOM)
    @IsISO8601({}, { message: 'hasta debe ser una fecha válida (YYYY-MM-DD)' })
    hasta?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'limit debe ser un entero' })
    @Min(1, { message: 'limit mínimo es 1' })
    @Max(100, { message: 'limit máximo es 100' })
    limit?: number;
}
