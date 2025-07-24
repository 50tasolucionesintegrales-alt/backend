import {ArgumentsHost,Catch,ExceptionFilter,HttpException,HttpStatus,} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionZodFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
        const exceptionRes = exception.getResponse?.();

        /**
         * Construimos siempre: { errors: [{ message, code?, field? }] }
         */
        const payload: any = { errors: [] as Array<{ message: string; code?: string; field?: string }> };

        // 1) Cuando lanzas excepciones Nest con string simple: new NotFoundException('Token no válido')
        if (typeof exceptionRes === 'string') {
            payload.errors.push({ message: exceptionRes });
        }

        // 2) Cuando Nest te da un objeto { message, error, statusCode } o un array de mensajes
        else if (typeof exceptionRes === 'object' && exceptionRes !== null) {
            const obj: any = exceptionRes;

            // a) Si ya vienes con { errors: [...] } desde el servicio, lo respetamos
            if (Array.isArray(obj.errors)) {
                payload.errors = obj.errors;
            } else if (Array.isArray(obj.message)) {
                // b) class-validator suele traer message: string[]
                payload.errors = obj.message.map((m: string) => ({ message: m }));
            } else if (typeof obj.message === 'string') {
                payload.errors.push({ message: obj.message });
            } else {
                // fallback genérico
                payload.errors.push({ message: 'Error inesperado' });
            }
        } else {
            payload.errors.push({ message: 'Error inesperado' });
        }

        response.status(status).json(payload);
    }
}
