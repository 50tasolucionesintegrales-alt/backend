import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  @MinLength(8)
  current_password: string;

    @IsString() @MinLength(8, {message:'Contraseña nueva no válida'})
    password: string;
}
