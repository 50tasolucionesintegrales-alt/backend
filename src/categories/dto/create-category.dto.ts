import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateCategoryDto {
    @IsNotEmpty({ message: 'El nombre no puede estar vacio' })
    @IsString({ message: 'El nombre debe ser texto' })
    nombre: string

    @IsOptional()
    @IsString({ message: 'La descripcion debe ser texto' })
    descripcion?: string
}
