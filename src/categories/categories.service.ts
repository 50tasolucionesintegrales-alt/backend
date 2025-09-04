import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
  ) { }

  // Crear categoria
  async create(createCategoryDto: CreateCategoryDto) {
    const exists = await this.findOneByName(createCategoryDto.nombre);
    if (exists) {
      throw new BadRequestException('Ya existe una categoría con ese nombre');
    }

    const category = this.categoryRepo.create(createCategoryDto);
    return this.categoryRepo.save(category);
  }

  // Actualizar una categoria
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const categoria = await this.findOne(id)

    if (updateCategoryDto.nombre && updateCategoryDto.nombre !== categoria.nombre) {
      const exists = await this.findOneByName(updateCategoryDto.nombre);
      if (exists) throw new BadRequestException('Ya existe otra categoría con ese nombre');
    }

    const data = {
      ...updateCategoryDto,
      descripcion: updateCategoryDto.descripcion ?? '',
    };

    Object.assign(categoria, data);

    return this.categoryRepo.save(categoria);
  }

  // Obtener todos las categorias
  findAll() {
    return this.categoryRepo.find()
  }

  // Eliminar categoria
  async remove(id: string) {
    const categoria = await this.findOne(id)
    await this.categoryRepo.delete(id)
    return { message: `Categoria ${categoria} eliminada` }
  }

  // Helpers
  async findOneByName(nombre: string): Promise<Category | null> {
    return this.categoryRepo.findOne({ where: { nombre } });
  }

  async findOne(id: string) {
    const categoria = await this.categoryRepo.findOneBy({ id })
    if (!categoria) throw new BadRequestException('La categoria no existe')
    return categoria
  }
}
