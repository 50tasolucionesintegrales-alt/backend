import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
  ) {}

  async create(dto: CreateTemplateDto) {
    const template = this.templateRepo.create(dto);
    await this.templateRepo.save(template);
    return { message: 'Template agregado', templateId: template.id };
  }

  async update(id: number, dto: UpdateTemplateDto) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template no encontrado');

    Object.assign(template, dto);
    await this.templateRepo.save(template);
    return { message: 'Template actualizado' };
  }

  async remove(id: number) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template no encontrado');

    await this.templateRepo.delete(id);
    return { message: `Template ${template.nombre} eliminado` };
  }

  async findAll() {
    return this.templateRepo.find({ order: { id: 'DESC' } }); // 👈 mejor usar id para el orden
  }

  async findOne(id: number) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template no encontrado');
    return template;
  }

  async getPdf(id: number) {
    const template = await this.findOne(id);

    if (!template.archivo) {
      throw new NotFoundException('Archivo PDF no encontrado');
    }

    return {
      buffer: template.archivo,
      mime: 'application/pdf',
      name: `${template.nombre}.pdf`,
      size: template.archivo.length,
    };
  }
}