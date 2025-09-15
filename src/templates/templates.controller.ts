import { 
  Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException, Res 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { Response } from 'express';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('archivo'))
  create(@Body() dto: CreateTemplateDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo PDF');
    }

    dto.archivo = file.buffer;
    return this.templatesService.create(dto);
  }

  @Get()
  findAll() {
    return this.templatesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.templatesService.findOne(id);
  }

  @Get(':id/pdf')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const pdf = await this.templatesService.getPdf(id);
    res.setHeader('Content-Type', pdf.mime);
    res.setHeader('Content-Length', pdf.size.toString());
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.name}"`);
    res.send(pdf.buffer);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('archivo'))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (file) dto.archivo = file.buffer;
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.templatesService.remove(id);
  }
}