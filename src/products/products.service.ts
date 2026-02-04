import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { Category } from 'src/categories/entities/category.entity';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    private readonly userService: UsersService,
  ) { }

  private assertAllowed(file?: Express.Multer.File) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Formato no permitido. Usa JPG, PNG, WEBP, HEIC/HEIF');
    }
    if (!file.buffer || file.size <= 0) {
      throw new BadRequestException('Archivo inválido');
    }
  }

  // CRUD
  async create(dto: CreateProductDto, userId: string, file?: Express.Multer.File) {
    const category = await this.categoryRepo.findOneBy({ id: dto.categoryId });
    if (!category) throw new BadRequestException('La categoría no existe');

    this.assertAllowed(file);

    const baseData: Partial<Product> = {
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      precio: dto.precio,
      especificaciones: dto.especificaciones,
      link_compra: dto.link_compra,
      category,
    };

    if (userId) {
      const user = await this.userService.findOne(userId);
      baseData.createdBy = user ?? null;
    }

    if (file) {
      baseData.imageData = file.buffer;
      baseData.imageMime = file.mimetype;
      baseData.imageName = file.originalname?.slice(0, 255) || null;
      baseData.imageSize = file.size ?? null;
    }

    const product = this.productRepo.create(baseData);
    await this.productRepo.save(product);

    return {message:"Producto Agregado"}
  }

  async update(id: string, dto: UpdateProductDto, file?: Express.Multer.File) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: { category: true, createdBy: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    if (dto.categoryId && dto.categoryId !== product.category.id) {
      const category = await this.categoryRepo.findOneBy({ id: dto.categoryId });
      if (!category) throw new BadRequestException('La categoría no existe');
      product.category = category;
    }

    this.assertAllowed(file);
    if (file) {
      product.imageData = file.buffer;
      product.imageMime = file.mimetype;
      product.imageName = file.originalname?.slice(0, 255) || null;
      product.imageSize = file.size ?? null;
    }

    Object.assign(product, {
      nombre: dto.nombre ?? product.nombre,
      descripcion: dto.descripcion ?? product.descripcion,
      precio: dto.precio ?? product.precio,
      especificaciones: dto.especificaciones ?? product.especificaciones,
      link_compra: dto.link_compra ?? product.link_compra,
    });

    await this.productRepo.save(product);

    return {message:"Producto Actualizado"}
  }

  async remove(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    
    const nom = product.nombre
    await this.productRepo.delete(id); // o await this.productRepo.remove(product);
    return { message: `Producto ${nom} eliminado` };
  }

  async findAll() {
    return this.productRepo.find({
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        precio: true,
        especificaciones: true,
        link_compra: true,
        createdAt: true,
        category: {
          id: true,
          nombre: true,
        },
        createdBy: {
          id: true,
          nombre: true, 
        },
      },
      // --- FIN DEL CAMBIO ---
      relations: { createdBy: true, category: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        precio: true,
        especificaciones: true,
        link_compra: true,
        createdAt: true,
        category: {
          id: true,
          nombre: true,
        },
        createdBy: {
          id: true,
          nombre: true,
        },
      },
      relations: { createdBy: true, category: true },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  async getImage(id: string) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (!product.imageData) throw new NotFoundException('Este producto no tiene imagen');

    return {
      buffer: product.imageData,
      mime: product.imageMime,
      name: product.imageName,
      size: product.imageSize,
    };
  }
}
