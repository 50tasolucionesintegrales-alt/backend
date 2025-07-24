import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { checkPassword, hashPassword } from 'src/common/utils/crypto.util';
import { generateRandomToken } from 'src/common/utils/token.util';
import { Role } from 'src/common/enums/roles.enum';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly mailService: MailService
  ) { }

  /* ───────── Registro ───────── */
  async register(dto: CreateUserDto) {
    const exists = await this.findByEmail(dto.email);
    if (exists) throw new ConflictException('El correo ya está en uso');

    return this.create(dto);
  }

  /* ───────── Confirmar cuenta ───────── */
  async confirmAccount(token: string) {
    const user = await this.findByToken(token);
    if (!user) throw new NotFoundException('Token no válido');

    user.confirmed = true;
    user.token = null;
    await this.userRepository.save(user);

    return { message: 'Cuenta confirmada correctamente' };
  }

  /* ───────── Recuperar contraseña ───────── */
  async forgotPassword(email: string) {
    const user = await this.findByEmail(email);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    user.token = generateRandomToken(6);
    await this.userRepository.save(user);

    await this.mailService.sendPasswordResetToken({
      nombre: user.nombre,
      email: user.email,
      token: user.token,
    });

    return { message: 'Revisa tu email' };
  }

  /* ───────── Validar token de reset ───────── */
  async validateResetToken(token: string) {
    const exists = await this.findByToken(token);
    if (!exists) throw new NotFoundException('Token no válido');
    return { message: 'Token válido...' }
  }

  /* ───────── Reset con token ───────── */
  async resetPassword(token: string, newPass: string) {
    const user = await this.findByToken(token);
    if (!user) throw new NotFoundException('Token no válido');

    user.password = await hashPassword(newPass);
    user.token = null;
    await this.userRepository.save(user);

    return { message: 'La contraseña se modificó correctamente' };
  }

  /* ───────── Cambiar contraseña autenticado ───────── */
  async updatePassword(userId: string, currentPass: string, newPass: string) {
    const user = await this.findOne(userId);
    const ok = await checkPassword(currentPass, user!.password);
    if (!ok) throw new UnauthorizedException('Contraseña actual incorrecta');

    user!.password = await hashPassword(newPass);
    await this.userRepository.save(user!);

    return { message: 'Contraseña actualizada' };
  }

  /* ───────── Verificar contraseña autenticado ───────── */
  async checkPassword(userId: string, pass: string) {
    const user = await this.findOne(userId);
    const ok = await checkPassword(pass, user!.password);
    if (!ok) throw new UnauthorizedException('Contraseña incorrecta');
    return { message: 'Contraseña correcta' };
  }


  /* ───────── Funciones de administrador ───────── */
  async findConfirmed() {
    return this.userRepository.find({ where: { confirmed: true } });
  }

  async setRole(id: string, rol: Role) {
    if (rol === Role.Admin) {
      throw new UnauthorizedException('No se puede asignar rol admin por esta ruta');
    }

    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.rol === Role.Admin) {
      throw new UnauthorizedException('No se puede modificar un usuario admin');
    }

    user.rol = rol;
    await this.userRepository.save(user);
    return { message: 'Rol actualizado', usuario: { id: user.id, rol } };
  }

  async findConfirmedUnassigned() {
    return this.userRepository.find({
      where: {
        confirmed: true,
        rol: Role.Unassigned, // enum o null, según tu columna
      },
      order: { createdAt: 'ASC' }, // opcional: ordena por fecha de alta
    });
  }

  async findConfirmedWithRoles() {
    return this.userRepository.find({
      where: [
        { confirmed: true, rol: Role.Cotizador },
        { confirmed: true, rol: Role.Comprador },
      ],
      order: { createdAt: 'ASC' },
    });
  }

  /* ───────── CRUD helpers ───────── */
  async findOne(id: string) {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByToken(token: string) {
    return this.userRepository.findOne({ where: { token } });
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
