// src/common/transformers/decimal.transformer.ts
import { ValueTransformer } from 'typeorm';

export const DecimalTransformer: ValueTransformer = {
    /* number | null  ->  string | null */
    to: (value?: number | null) =>
        value === null || value === undefined ? value : value.toString(),

    /* string | null  ->  number | null */
    from: (value: string | null) =>
        value === null ? null : parseFloat(value),
};
