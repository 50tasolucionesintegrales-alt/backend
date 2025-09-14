import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class GeneratePdfDto {
    @IsEnum([1, 2, 3, 4, 5, 6, 7] as const)
    empresa!: 1 | 2 | 3 | 4 | 5 | 6 | 7;

    @IsString() @IsNotEmpty({ message: "El destinatario es obligatorio" })
    destinatario!: string;

    @IsString() @IsNotEmpty({ message: "La descripción es obligatoria" })
    descripcion!: string;

    @IsString() @IsNotEmpty({message: "La fecha es obligatoria"})
    fecha!: string;
}
