import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { hashPassword } from 'src/common/utils/crypto.util';
import { generateRandomToken } from 'src/common/utils/token.util';
import { Role } from 'src/common/enums/roles.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  /* ---------- Registro ---------- */
  async register(dto: CreateUserDto) {
    const exists = await this.findByEmail(dto.email);
    if (exists) throw new ConflictException('El correo ya está en uso');
    return this.create(dto);
  }

  /* ---------- Confirmar cuenta ---------- */
  async confirmAccount(token: string) {
    const user = await this.userRepository.findOne({ where: { token } });
    if (!user) throw new NotFoundException('Token no válido');

    user.confirmed = true;
    user.token = null;
    await this.userRepository.save(user);

    return { message: 'Cuenta confirmada correctamente' };
  }

  /* ---------- Validar token ---------- */
  async validateResetToken(token: string) {
    const exists = await this.userRepository.findOne({ where: { token } });
    if (!exists) throw new NotFoundException('Token no válido');
  }

  /* ---------- Resetear contraseña con token ---------- */
  async resetPassword(token: string, newPass: string) {
    const user = await this.userRepository.findOne({ where: { token } });
    if (!user) throw new NotFoundException('Token no válido');

    user.password = await hashPassword(newPass);
    user.token = null;
    await this.userRepository.save(user);
  }

  //Administrador
  async findConfirmed() {
    return this.userRepository.find({ where: { confirmed: true } });
  }

  async setRole(id: string, rol: Role) {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    user.rol = rol;
    await this.userRepository.save(user);
    return {
      message: 'Rol actualizado',
      usuario: { id: user.id, rol: user.rol },
    };
  }

  // users.service.ts
  async findConfirmedUnassigned() {
    return this.userRepository.find({
      where: {
        confirmed: true,
        rol: Role.Unassigned, // enum o null, según tu columna
      },
      order: { createdAt: 'ASC' }, // opcional: ordena por fecha de alta
    });
  }

  //Crud general del servicio
  async findOne(id: string) {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  async create(dto: CreateUserDto) {
    const user = this.userRepository.create({
      ...dto,
      rol: Role.Unassigned,
      password: await hashPassword(dto.password),
      token: generateRandomToken(6),
      confirmed: false,
    });
    await this.userRepository.save(user);
    return user;
  }
}
