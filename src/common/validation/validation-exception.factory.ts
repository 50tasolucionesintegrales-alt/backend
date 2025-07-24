// src/common/validation/validation-exception.factory.ts
import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export function validationExceptionFactory(errors: ValidationError[]) {
    const formatted = flattenValidationErrors(errors);
    return new BadRequestException({ errors: formatted });
}

function flattenValidationErrors(errors: ValidationError[]) {
    const result: Array<{ field: string; message: string }> = [];

    const walk = (errList: ValidationError[], parentPath = '') => {
        for (const err of errList) {
            const path = parentPath ? `${parentPath}.${err.property}` : err.property;
            if (err.constraints) {
                Object.values(err.constraints).forEach((msg) =>
                    result.push({ field: path, message: msg }),
                );
            }
            if (err.children?.length) walk(err.children, path);
        }
    };

    walk(errors);
    return result;
}
