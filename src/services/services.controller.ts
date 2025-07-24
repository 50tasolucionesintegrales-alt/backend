import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { IdValidationPipe } from 'src/common/pipes/id-validation/id-validation.pipe';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@UseGuards(JwtAuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  create(@Body() dto: CreateServiceDto, @Req() req: any) {
    return this.servicesService.create(dto, req.user.id);
  }

  @Get()
  findAll() {
    return this.servicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', IdValidationPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', IdValidationPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @Req() req: any,
  ) {
    return this.servicesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.servicesService.remove(id);
  }
}
