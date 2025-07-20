import {Injectable,NotFoundException,ForbiddenException,UnauthorizedException,} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { checkPassword } from '../common/utils/crypto.util';
import { LoginDto } from './dto/login.dto';
import { generateJWT } from 'src/common/utils/jwt.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService
  ) { }

  async login(dto:LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new NotFoundException('El e-mail no existe');
    if (!user.confirmed) throw new ForbiddenException('Cuenta no confirmada');

    const ok = await checkPassword(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Contraseña incorrecta');

    const token = generateJWT({ sub: user.id, rol: user.rol });

    return {
      message:"Autenticado...",
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
    };
  }
}
