import { IsString, MinLength } from 'class-validator';

// update-password.dto.ts
export class UpdatePasswordDto {
  @IsString()
  @MinLength(8)
  current_password: string;

  @IsString()
  @MinLength(8)
  password: string;
}
