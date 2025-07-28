import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, UseGuards, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { IdValidationPipe } from 'src/common/pipes/id-validation/id-validation.pipe';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FileValidationPipe } from 'src/common/pipes/file-validation/file-validation.pipe';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Body() dto: CreateProductDto,
    @UploadedFile(new FileValidationPipe({ required: false })) file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.productsService.create(dto, req.user.id, file);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', IdValidationPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  update(
    @Param('id', IdValidationPipe) id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile(new FileValidationPipe({ required: false })) file: Express.Multer.File
  ) {
    return this.productsService.update(id, dto, file);
  }

  @Delete(':id')
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.productsService.remove(id);
  }
}
