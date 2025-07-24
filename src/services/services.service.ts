import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { User } from '../users/entities/user.entity'; // ajusta ruta
// o tu UsersService si prefieres validarlo ahí

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>, // opcional si validas user
  ) {}

  // CREATE
  async create(dto: CreateServiceDto, userId: string) {
    let createdBy: User | undefined;

    const user = await this.userRepo.findOne({ where: { id: userId } }); // User | null
    createdBy = user ?? undefined; // convierte null -> undefined

    const entity = this.serviceRepo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? '',
      precioBase: dto.precioBase,
      createdBy,
    });

    const saved = await this.serviceRepo.save(entity);

    // devolver con relación
    return this.serviceRepo.findOne({
      where: { id: saved.id },
      relations: { createdBy: true },
    });
  }

  // FIND ALL
  async findAll() {
    return this.serviceRepo.find({
      relations: { createdBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  // FIND ONE
  async findOne(id: string) {
    const service = await this.serviceRepo.findOne({
      where: { id },
      relations: { createdBy: true },
    });
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }

  // UPDATE
  async update(id: string, dto: UpdateServiceDto, userId: string) {
    const service = await this.findOne(id); // lanza NotFound si no existe

    // (opcional) si quieres registrar quién lo modificó en otro campo, hazlo aquí
    // const updater = await this.userRepo.findOneBy({ id: userId });

    Object.assign(service, {
      nombre: dto.nombre ?? service.nombre,
      descripcion: dto.descripcion ?? service.descripcion ?? '',
      precioBase: dto.precioBase ?? service.precioBase,
    });

    const saved = await this.serviceRepo.save(service);

    return this.serviceRepo.findOne({
      where: { id: saved.id },
      relations: { createdBy: true },
    });
  }

  // DELETE
  async remove(id: string) {
    await this.findOne(id); // valida existencia
    await this.serviceRepo.delete(id);
    return { message: `Servicio ${id} eliminado correctamente` };
  }
}
