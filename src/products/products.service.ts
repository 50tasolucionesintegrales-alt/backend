import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { Category } from 'src/categories/entities/category.entity';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    private readonly userService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  // CRUD
  async create(createProductDto: CreateProductDto, userId: string, file?: Express.Multer.File) {
    // 1. Validar categoría
    const category = await this.categoryRepo.findOneBy({
      id: createProductDto.categoryId,
    });
    if (!category) {
      throw new BadRequestException('La categoría no existe');
    }

    // 2. Subir imagen (si se manda)
    let imageUrl = '';
    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file, 'products');
      imageUrl = uploaded.secure_url;
    }

    // 3. Armar datos base del producto
    const baseData: Partial<Product> = {
      nombre: createProductDto.nombre,
      descripcion: createProductDto.descripcion ?? '',
      precio: createProductDto.precio,
      especificaciones: createProductDto.especificaciones,
      link_compra: createProductDto.link_compra,
      image_url: imageUrl,
      category,
    };

    // Usuario creador
    if (userId) {
      const user = await this.userService.findOne(userId);
      baseData.createdBy = user; 
    }

    const product = this.productRepo.create(baseData);
    const saved = await this.productRepo.save(product);

    // Vuelve a cargar con relaciones (createdBy no es eager)
    return this.productRepo.findOne({
      where: { id: saved.id },
      relations: { createdBy: true, category: true },
    });
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    file?: Express.Multer.File,
  ) {
    // 1. Traer el producto actual
    const product = await this.productRepo.findOne({
      where: { id },
      relations: { category: true, createdBy: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // 2. Cambiar categoría si viene
    if (dto.categoryId && dto.categoryId !== product.category.id) {
      const category = await this.categoryRepo.findOneBy({ id: dto.categoryId });
      if (!category) throw new BadRequestException('La categoría no existe');
      product.category = category;
    }

    // 3. Reemplazar imagen si mandan una nueva
    if (file) {
      const uploaded = await this.cloudinaryService.replaceImage(
        product.image_url || null,
        file,
        'products',
      );
      product.image_url = uploaded.secure_url;
    }

    // 4. Asignar el resto de campos (sanitizando descripción)
    Object.assign(product, {
      nombre: dto.nombre ?? product.nombre,
      descripcion: dto.descripcion ?? product.descripcion ?? '',
      precio: dto.precio ?? product.precio,
      especificaciones: dto.especificaciones ?? product.especificaciones,
      link_compra: dto.link_compra ?? product.link_compra,
    });

    const saved = await this.productRepo.save(product);

    // 5. Regresar con relaciones
    return this.productRepo.findOne({
      where: { id: saved.id },
      relations: { createdBy: true, category: true },
    });
  }

  async remove(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // borrar imagen en Cloudinary (no fallar si algo sale mal)
    if (product.image_url) {
      try {
        await this.cloudinaryService.deleteByUrl(product.image_url);
      } catch { }
    }

    await this.productRepo.delete(id); // o await this.productRepo.remove(product);
    return { message: `Producto ${id} eliminado correctamente` };
  }

  async findAll() {
    return this.productRepo.find({
      relations: { createdBy: true, category: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: { createdBy: true, category: true },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }



}
