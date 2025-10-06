import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class GeneratePdfDto {
    @IsInt() @Min(1) @Max(7)
    empresa!: 1 | 2 | 3 | 4 | 5 | 6 | 7;

    // OBLIGATORIOS por formato:
    @IsString() @IsNotEmpty({message:"El destinatario es obligatorio"})
    destinatario!: string;

    @IsString() @IsNotEmpty({message:"La descripcion es obligatoria"})
    descripcion!: string;

    @IsString() @IsNotEmpty({message:"La fecha es obligatoria"})  // formato libre: "05 de octubre de 2025" o "2025-10-05"
    fecha!: string;

    @IsString() @IsNotEmpty({message:"El folio es obligatorio"})
    folio!: string;
    
    // OPCIONALES (toman default si faltan)
    @IsString() @IsOptional()
    lugar?: string; // default: "Pachuca de Soto, Hidalgo"

    @IsString() @IsOptional()
    presente?: string; // default: true

    @IsString() @IsOptional()
    condiciones?: string; // HTML/Texto. Default vacío.

    @IsBoolean() @IsOptional()
    incluirFirma?: boolean; // default: false
}
