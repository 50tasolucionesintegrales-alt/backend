import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

import { Product } from 'src/products/entities/product.entity';
import { Category } from 'src/categories/entities/category.entity';
import { Quote } from 'src/quotes/entities/quote.entity';
import { QuoteItem } from 'src/quotes/entities/quote-item.entity';
import { User } from 'src/users/entities/user.entity';

const PLACEHOLDER_IMAGE_PATH = path.join(
  process.cwd(),
  'src',
  'pdf',
  'assets',
  'product-placeholder.png',
);

function getPlaceholderImage(): Buffer {
  if (fs.existsSync(PLACEHOLDER_IMAGE_PATH)) {
    return fs.readFileSync(PLACEHOLDER_IMAGE_PATH);
  }
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
}

function empBaseCol(ei: number): number {
  return 8 + ei * 5;
}

export interface ImportRowError {
  fila: number;
  campo: string;
  mensaje: string;
}

export interface ImportResult {
  ok: boolean;
  quoteId?: string;
  productosCreados?: number;
  productosReutilizados?: number;
  advertencias?: string[];
  errors?: ImportRowError[];
}

@Injectable()
export class ExcelImportService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    @InjectRepository(QuoteItem)
    private readonly itemRepo: Repository<QuoteItem>,
    private readonly dataSource: DataSource,
  ) {}

  async importFromExcel(
    buffer: Buffer,
    empresaIds: number[],
    userId: string,
  ): Promise<ImportResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    const ws = wb.getWorksheet('Cotización');
    if (!ws) {
      throw new BadRequestException(
        'El archivo no tiene una hoja llamada "Cotización"',
      );
    }

    const titulo = this.cellStr(ws.getCell(5, 3));
    const tipo = this.cellStr(ws.getCell(6, 3)).toLowerCase();

    if (!titulo || titulo.trim() === '') {
      throw new BadRequestException('El campo Título (fila 5) es obligatorio');
    }
    if (tipo !== 'productos' && tipo !== 'servicios') {
      throw new BadRequestException(
        'El campo Tipo (fila 6) debe ser "productos" o "servicios"',
      );
    }

    const globalMargins: (number | null)[] = empresaIds.map((_, ei) => {
      const val = ws.getCell(10, empBaseCol(ei)).value;
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
    });

    const allCategories = await this.categoryRepo.find();
    const catMap = new Map<string, Category>();
    for (const cat of allCategories) {
      catMap.set(cat.nombre.toLowerCase().trim(), cat);
    }

    const DATA_START = 12;
    const errors: ImportRowError[] = [];
    const rows: {
      rowNum: number;
      nombre: string;
      descripcion: string;
      categoria: Category;
      cantidad: number;
      unidad: string;
      costo: number;
      margenesPorEmpresa: Map<number, number | null>;
    }[] = [];

    let rowNum = DATA_START;
    while (rowNum <= DATA_START + 200) {
      const nombre = this.cellStr(ws.getCell(rowNum, 2));

      // Fin de datos: celda B vacía
      if (!nombre) break;

      // ── Detectar fila de totales ──
      // Col A en filas de datos siempre tiene un número entero (1, 2, 3...)
      // En filas de totales col A tiene texto propagado del merge o null
      const colA = ws.getCell(rowNum, 1).value;
      const colANum = Number(colA);
      if (!Number.isInteger(colANum) || colANum <= 0) break;

      const descripcion = this.cellStr(ws.getCell(rowNum, 3));
      const catNombre = this.cellStr(ws.getCell(rowNum, 4));
      const cantRaw = ws.getCell(rowNum, 5).value;
      const unidad = this.cellStr(ws.getCell(rowNum, 6)) || 'pieza';
      const costoRaw = ws.getCell(rowNum, 7).value;

      let hasError = false;

      if (nombre.length < 3 || nombre.length > 255) {
        errors.push({
          fila: rowNum,
          campo: 'Nombre',
          mensaje: 'Debe tener entre 3 y 255 caracteres',
        });
        hasError = true;
      }

      if (!descripcion || descripcion.length < 20) {
        errors.push({
          fila: rowNum,
          campo: 'Descripción',
          mensaje: 'Obligatoria, mínimo 20 caracteres',
        });
        hasError = true;
      } else if (descripcion.length > 128) {
        errors.push({
          fila: rowNum,
          campo: 'Descripción',
          mensaje: 'Máximo 128 caracteres',
        });
        hasError = true;
      }

      const category = catMap.get(catNombre.toLowerCase().trim());
      if (!category) {
        errors.push({
          fila: rowNum,
          campo: 'Categoría',
          mensaje: `La categoría "${catNombre}" no existe en el sistema`,
        });
        hasError = true;
      }

      const cantidad = Number(cantRaw);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        errors.push({
          fila: rowNum,
          campo: 'Cantidad',
          mensaje: 'Debe ser un entero mayor a 0',
        });
        hasError = true;
      }

      const costo = Number(costoRaw);
      if (!isFinite(costo) || costo <= 0) {
        errors.push({
          fila: rowNum,
          campo: 'Costo Unitario',
          mensaje: 'Debe ser un número mayor a 0',
        });
        hasError = true;
      }

      if (unidad.length > 30) {
        errors.push({
          fila: rowNum,
          campo: 'Unidad',
          mensaje: 'Máximo 30 caracteres',
        });
        hasError = true;
      }

      const margenesPorEmpresa = new Map<number, number | null>();
      for (let ei = 0; ei < empresaIds.length; ei++) {
        const empresaId = empresaIds[ei];
        const val = ws.getCell(rowNum, empBaseCol(ei)).value;

        if (val === null || val === undefined || val === '') {
          margenesPorEmpresa.set(empresaId, globalMargins[ei]);
        } else {
          const n = Number(val);
          if (isNaN(n) || n < 0 || n > 1000) {
            errors.push({
              fila: rowNum,
              campo: `%Ítem empresa ${empresaId}`,
              mensaje: 'Debe ser un número entre 0 y 1000',
            });
          } else {
            margenesPorEmpresa.set(empresaId, n);
          }
        }
      }

      if (!hasError && category) {
        rows.push({
          rowNum,
          nombre,
          descripcion,
          categoria: category,
          cantidad,
          unidad,
          costo,
          margenesPorEmpresa,
        });
      }

      rowNum++;
    }

    if (rows.length === 0 && errors.length === 0) {
      throw new BadRequestException('El archivo no contiene productos');
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    const advertencias: string[] = [];
    let productosCreados = 0;
    let productosReutilizados = 0;
    let quoteId = '';

    await this.dataSource.transaction(async (manager) => {
      const productRepoTx = manager.getRepository(Product);
      const quoteRepoTx = manager.getRepository(Quote);
      const itemRepoTx = manager.getRepository(QuoteItem);

      const quote = quoteRepoTx.create({
        user: { id: userId } as User,
        titulo: titulo.trim(),
        tipo: tipo as 'productos' | 'servicios',
        status: 'draft',
        ivaPct: 16,
      });
      const savedQuote = await quoteRepoTx.save(quote);
      quoteId = savedQuote.id;

      for (const row of rows) {
        const existingProduct = await productRepoTx
          .createQueryBuilder('p')
          .where('LOWER(p.nombre) = LOWER(:nombre)', { nombre: row.nombre })
          .andWhere('p.category_id = :catId', { catId: row.categoria.id })
          .getOne();

        let product: Product;

        if (existingProduct && Number(existingProduct.precio) === row.costo) {
          product = existingProduct;
          productosReutilizados++;
          advertencias.push(
            `Fila ${row.rowNum}: producto "${row.nombre}" ya existía — se reutilizó (ID: ${product.id})`,
          );
        } else {
          product = productRepoTx.create({
            nombre: row.nombre,
            descripcion: row.descripcion,
            precio: String(row.costo),
            category: row.categoria,
            createdBy: { id: userId } as User,
            imageData: getPlaceholderImage(),
            imageMime: 'image/png',
            imageName: 'default-product.png',
            imageSize: getPlaceholderImage().length,
          });
          await productRepoTx.save(product);
          productosCreados++;
        }

        const item = itemRepoTx.create({
          quote: savedQuote,
          product,
          cantidad: row.cantidad,
          unidad: row.unidad,
          costo_unitario: row.costo,
        });

        for (const [empresaId, margen] of row.margenesPorEmpresa) {
          const precioFinal =
            margen !== null
              ? +(row.costo * (1 + margen / 100)).toFixed(2)
              : row.costo;
          const subtotal = +(precioFinal * row.cantidad).toFixed(2);

          (item as any)[`margenPct${empresaId}`] = margen;
          (item as any)[`precioFinal${empresaId}`] = precioFinal;
          (item as any)[`subtotal${empresaId}`] = subtotal;
        }

        await itemRepoTx.save(item);
      }

      const allItems = await itemRepoTx.find({
        where: { quote: { id: quoteId } },
      });
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const ivaPct = 16;

      for (const empresaId of empresaIds) {
        const subtotalSum = allItems.reduce(
          (acc, it) => acc + Number((it as any)[`subtotal${empresaId}`] ?? 0),
          0,
        );
        const totalIva = round2((subtotalSum * ivaPct) / 100);
        const totalFinal = round2(subtotalSum + totalIva);

        (savedQuote as any)[`totalMargen${empresaId}`] = round2(subtotalSum);
        (savedQuote as any)[`totalIva${empresaId}`] = totalIva;
        (savedQuote as any)[`totalFinal${empresaId}`] = totalFinal;
      }

      await quoteRepoTx.save(savedQuote);
    });

    return {
      ok: true,
      quoteId,
      productosCreados,
      productosReutilizados,
      advertencias: advertencias.length > 0 ? advertencias : undefined,
    };
  }

  private cellStr(cell: ExcelJS.Cell): string {
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object' && 'result' in val) {
      return String((val as any).result ?? '').trim();
    }
    return String(val).trim();
  }
}
