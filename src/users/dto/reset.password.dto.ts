import { IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
    @IsString()
    @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    password: string;
}
