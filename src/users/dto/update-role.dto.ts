import { IsEnum } from 'class-validator';
import { Role } from 'src/common/enums/roles.enum';

export class UpdateRoleDto {
    @IsEnum(Role, { message: 'rol inválido' })
    rol: Role;
}
