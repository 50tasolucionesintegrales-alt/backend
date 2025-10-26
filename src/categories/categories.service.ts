import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto) {
    const nombre = dto.nombre.trim();
    const exists = await this.categoryRepo.findOne({
      where: { nombre: ILike(nombre) },
    });

    if (exists) throw new BadRequestException('Ya existe una categoría con ese nombre');

    const category = this.categoryRepo.create({
      nombre,
      descripcion: dto.descripcion ?? '',
    });

    return this.categoryRepo.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const categoria = await this.findOne(id);

    if (dto.nombre && dto.nombre.trim() !== categoria.nombre) {
      const nombre = dto.nombre.trim();
      const exists = await this.categoryRepo.findOne({
        where: { nombre: ILike(nombre) },
      });

      if (exists && exists.id !== id) {
        throw new BadRequestException('Ya existe otra categoría con ese nombre');
      }

      categoria.nombre = nombre;
    }

    if (dto.descripcion !== undefined) {
      categoria.descripcion = dto.descripcion ?? '';
    }

    return this.categoryRepo.save(categoria);
  }

  findAll() {
    return this.categoryRepo.find();
  }

  async remove(id: string) {
    const categoria = await this.findOne(id);
    await this.categoryRepo.delete(id);
    return { message: `Categoría "${categoria.nombre}" eliminada` };
  }

  async findOne(id: string) {
    const categoria = await this.categoryRepo.findOneBy({ id });
    if (!categoria) throw new BadRequestException('La categoría no existe');
    return categoria;
  }

  // Búsqueda por nombre (typeahead)
  async searchByName(q: string) {
    return this.categoryRepo.find({
      where: { nombre: ILike(`%${q.trim()}%`) },
      take: 10,
      order: { nombre: 'ASC' },
    });
  }
}