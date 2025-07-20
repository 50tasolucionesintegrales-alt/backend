import {IsString, IsNotEmpty, IsEmail, MinLength, IsOptional, IsEnum } from 'class-validator'
import { Role } from '../entities/user.entity';

export class CreateUserDto {
    @IsString({ message: 'El nombre no puede estar vacío' }) 
    @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
    nombre: string;

    @IsEmail({},{ message: 'E‑mail no válido' })
    email: string;

    @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    password: string;

    @IsOptional()
    @IsEnum(Role)
    rol?: Role; // → ADMIN | COMPRADOR | COTIZADOR
}
