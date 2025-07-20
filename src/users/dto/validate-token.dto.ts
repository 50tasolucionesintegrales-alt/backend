import { IsString, Length } from "class-validator";

export class ValidateTokenDto {
    @IsString()
    @Length(6, 6, { message: 'Token no válido' })
    token: string;
}