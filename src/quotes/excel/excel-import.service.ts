import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

import { Product } from 'src/products/entities/product.entity';
import { Service } from 'src/services/entities/service.entity';
import { Category } from 'src/categories/entities/category.entity';
import { Quote } from 'src/quotes/entities/quote.entity';
import { QuoteItem } from 'src/quotes/entities/quote-item.entity';
import { User } from 'src/users/entities/user.entity';

const PLACEHOLDER_IMAGE_PATH = path.join(
  process.cwd(),
  'src',
  'pdf',
  'assets',
  'product-placeholder-small.png',
);

const DANGEROUS_CHARS = /[<>"'`;=\-\-\/\*\\]/g;
const HTML_TAGS = /<[^>]*>/g;

let PLACEHOLDER_BUFFER: Buffer | null = null;
let PLACEHOLDER_SIZE: number = 0;

function getPlaceholderImage(): { buffer: Buffer; size: number } {
  if (!PLACEHOLDER_BUFFER) {
    if (fs.existsSync(PLACEHOLDER_IMAGE_PATH)) {
      PLACEHOLDER_BUFFER = fs.readFileSync(PLACEHOLDER_IMAGE_PATH);
    } else {
      PLACEHOLDER_BUFFER = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64',
      );
    }
    PLACEHOLDER_SIZE = PLACEHOLDER_BUFFER.length;
  }
  return { buffer: PLACEHOLDER_BUFFER, size: PLACEHOLDER_SIZE };
}

function empBaseCol(ei: number): number {
  return 8 + ei * 5;
}

function sanitize(value: string): string {
  return value.replace(HTML_TAGS, '').replace(DANGEROUS_CHARS, '').trim();
}

function isBlankString(value: string): boolean {
  return value.trim().length === 0;
}

function hashBuffer(buf: Buffer): string {
  return crypto.createHash('md5').update(buf).digest('hex');
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
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
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
    tipoSeleccionado: 'productos' | 'servicios',
  ): Promise<ImportResult> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException(
        'El archivo no se pudo leer. Asegúrate de que sea un Excel (.xlsx) válido y sin contraseña.',
      );
    }

    const ws = wb.getWorksheet('Cotización');
    if (!ws) {
      throw new BadRequestException(
        'El archivo no es una plantilla válida de SinCuenta. La hoja "Cotización" no existe o fue renombrada.',
      );
    }

    const wsMeta = wb.getWorksheet('_Meta');
    if (!wsMeta) {
      throw new BadRequestException(
        'El archivo no es una plantilla válida de SinCuenta. Descarga una nueva plantilla.',
      );
    }

    const fingerprint = this.cellStr(wsMeta.getCell(1, 1));
    if (fingerprint !== 'SINCUENTA_V2') {
      throw new BadRequestException(
        'El archivo usa una versión antigua de la plantilla. Descarga una nueva plantilla.',
      );
    }

    const empresasEnMeta = this.cellStr(wsMeta.getCell(2, 1));
    const idsEnMeta = empresasEnMeta
      .split(',')
      .map(Number)
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    const idsSeleccionados = [...empresaIds].sort((a, b) => a - b);

    if (JSON.stringify(idsEnMeta) !== JSON.stringify(idsSeleccionados)) {
      throw new BadRequestException(
        `Las organizaciones del archivo no coinciden con las seleccionadas. ` +
          `El archivo fue generado para las organizaciones: ${idsEnMeta.join(', ')}. ` +
          `Descarga una nueva plantilla con las organizaciones correctas.`,
      );
    }

    const tipoEnMeta = this.cellStr(wsMeta.getCell(4, 1));
    if (tipoEnMeta && tipoEnMeta !== tipoSeleccionado) {
      throw new BadRequestException(
        `La plantilla es de "${tipoEnMeta}" pero seleccionaste "${tipoSeleccionado}". ` +
          `Descarga una nueva plantilla del tipo correcto.`,
      );
    }

    const fileHash = hashBuffer(buffer);
    const recentQuotes = await this.quoteRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    const advertencias: string[] = [];
    if (recentQuotes.some((q) => (q as any).excelHash === fileHash)) {
      advertencias.push(
        'Advertencia: Este archivo ya fue importado anteriormente. Se creará una nueva cotización de todas formas.',
      );
    }

    const tituloRaw = this.cellStr(ws.getCell(5, 3));
    const tipoRaw = this.cellStr(ws.getCell(6, 3)).toLowerCase().trim();
    const descripcionCotRaw = this.cellStr(ws.getCell(7, 3));

    if (!tituloRaw || isBlankString(tituloRaw)) {
      throw new BadRequestException('El campo Título (fila 5) es obligatorio.');
    }

    const titulo = sanitize(tituloRaw);
    if (titulo.length < 3) {
      throw new BadRequestException(
        'El Título debe tener al menos 3 caracteres válidos.',
      );
    }

    if (tipoRaw !== 'productos' && tipoRaw !== 'servicios') {
      throw new BadRequestException(
        'El campo Tipo (fila 6) debe ser "productos" o "servicios".',
      );
    }

    const tipo = tipoRaw as 'productos' | 'servicios';
    const esServicios = tipo === 'servicios';
    const descripcionCot = descripcionCotRaw
      ? sanitize(descripcionCotRaw)
      : null;

    const tituloExistente = await this.quoteRepo.findOne({
      where: { user: { id: userId }, titulo: titulo.trim(), status: 'sent' },
    });
    if (tituloExistente) {
      throw new BadRequestException(
        `Ya existe una cotización con el título "${titulo}". Cambia el título en el Excel e intenta de nuevo.`,
      );
    }

    const globalMargins: (number | null)[] = empresaIds.map((_, ei) => {
      const val = ws.getCell(11, empBaseCol(ei)).value;
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      if (isNaN(n)) return null;
      if (n === 0) {
        advertencias.push(
          `Advertencia: La organización ${empresaIds[ei]} tiene margen global 0%. El precio final será igual al costo.`,
        );
      }
      return n;
    });

    const catMap = new Map<string, Category>();
    if (!esServicios) {
      const allCategories = await this.categoryRepo.find();
      for (const cat of allCategories) {
        catMap.set(cat.nombre.toLowerCase().trim(), cat);
      }
    }

    const DATA_START = 13;
    const errors: ImportRowError[] = [];
    const rows: {
      rowNum: number;
      nombre: string;
      descripcion: string;
      categoria: Category | null;
      cantidad: number;
      unidad: string;
      costo: number;
      margenesPorEmpresa: Map<number, number | null>;
    }[] = [];

    const nombresVistos = new Set<string>();

    let rowNum = DATA_START;
    while (rowNum <= DATA_START + 1000) {
      const nombreRaw = this.cellStr(ws.getCell(rowNum, 2));
      if (!nombreRaw) break;

      const colA = ws.getCell(rowNum, 1).value;
      const colANum = Number(colA);
      if (!Number.isInteger(colANum) || colANum <= 0) break;

      const descripcionRaw = this.cellStr(ws.getCell(rowNum, 3));
      const catNombre = this.cellStr(ws.getCell(rowNum, 4));
      const cantRaw = ws.getCell(rowNum, 5).value;
      const unidadRaw = this.cellStr(ws.getCell(rowNum, 6)) || 'pieza';
      const costoRaw = ws.getCell(rowNum, 7).value;

      const nombre = sanitize(nombreRaw);
      const descripcion = sanitize(descripcionRaw);
      const unidad = sanitize(unidadRaw);

      let hasError = false;

      if (isBlankString(nombre)) {
        errors.push({
          fila: rowNum,
          campo: 'Nombre',
          mensaje: 'No puede estar vacío o contener solo espacios',
        });
        hasError = true;
      } else if (nombre.length < 3 || nombre.length > 255) {
        errors.push({
          fila: rowNum,
          campo: 'Nombre',
          mensaje: 'Debe tener entre 3 y 255 caracteres',
        });
        hasError = true;
      }

      const nombreKey = nombre.toLowerCase().trim();
      if (nombresVistos.has(nombreKey)) {
        errors.push({
          fila: rowNum,
          campo: 'Nombre',
          mensaje: `El elemento "${nombre}" ya aparece en una fila anterior del archivo`,
        });
        hasError = true;
      } else {
        nombresVistos.add(nombreKey);
      }

      const maxDescripcion = esServicios ? 2500 : 300;

      if (isBlankString(descripcion)) {
        errors.push({
          fila: rowNum,
          campo: 'Descripción',
          mensaje: 'No puede estar vacía o contener solo espacios',
        });
        hasError = true;
      } else if (descripcion.length > maxDescripcion) {
        errors.push({
          fila: rowNum,
          campo: 'Descripción',
          mensaje: `Máximo ${maxDescripcion} caracteres`,
        });
        hasError = true;
      }


      let category: Category | null = null;
      if (!esServicios) {
        category = catMap.get(catNombre.toLowerCase().trim()) ?? null;
        if (!category) {
          errors.push({
            fila: rowNum,
            campo: 'Categoría',
            mensaje: `La categoría "${catNombre}" no existe en el sistema`,
          });
          hasError = true;
        }
      }

      const cantidad = Number(cantRaw);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        errors.push({
          fila: rowNum,
          campo: 'Cantidad',
          mensaje: 'Debe ser un entero mayor a 0',
        });
        hasError = true;
      } else if (cantidad > 100000) {
        errors.push({
          fila: rowNum,
          campo: 'Cantidad',
          mensaje: 'No puede exceder 100,000 unidades',
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
      } else if (costo > 10000000) {
        errors.push({
          fila: rowNum,
          campo: 'Costo Unitario',
          mensaje: 'No puede exceder $10,000,000',
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
          if (isNaN(n) || n < -100 || n > 100) {
            errors.push({
              fila: rowNum,
              campo: `%Ítem empresa ${empresaId}`,
              mensaje: 'Debe ser un número entre -100 y 100',
            });
          } else {
            if (n === 0) {
              advertencias.push(
                `Fila ${rowNum}: organización ${empresaId} tiene % Ítem 0. El precio final será igual al costo.`,
              );
            }
            margenesPorEmpresa.set(empresaId, n);
          }
        }
      }

      if (!hasError && (esServicios || category)) {
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
      throw new BadRequestException(
        `El archivo no contiene ${esServicios ? 'servicios' : 'productos'}.`,
      );
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    let productosCreados = 0;
    let productosReutilizados = 0;
    let quoteId = '';
    const { buffer: placeholderBuffer, size: placeholderSize } =
      getPlaceholderImage();

    await this.dataSource.transaction(async (manager) => {
      const productRepoTx = manager.getRepository(Product);
      const serviceRepoTx = manager.getRepository(Service);
      const quoteRepoTx = manager.getRepository(Quote);
      const itemRepoTx = manager.getRepository(QuoteItem);

      const quote = quoteRepoTx.create({
        user: { id: userId } as User,
        titulo: titulo.trim(),
        descripcion: descripcionCot,
        tipo,
        status: 'sent',
        sentAt: new Date(),
        ivaPct: 16,
      });
      const savedQuote = await quoteRepoTx.save(quote);
      quoteId = savedQuote.id;

      const nombresEnExcel = rows.map((r) => r.nombre.toLowerCase().trim());
      let existingMap = new Map<string, { id: string }>();

      if (esServicios) {
        const existingServices = await serviceRepoTx
          .createQueryBuilder('s')
          .select(['s.id', 's.nombre'])
          .where('LOWER(s.nombre) IN (:...nombres)', {
            nombres: nombresEnExcel,
          })
          .getMany();
        existingMap = new Map(
          existingServices.map((s) => [
            s.nombre.toLowerCase().trim(),
            { id: s.id },
          ]),
        );
      } else {
        const existingProducts = await productRepoTx
          .createQueryBuilder('p')
          .select(['p.id', 'p.nombre'])
          .where('LOWER(p.nombre) IN (:...nombres)', {
            nombres: nombresEnExcel,
          })
          .getMany();
        existingMap = new Map(
          existingProducts.map((p) => [
            p.nombre.toLowerCase().trim(),
            { id: p.id },
          ]),
        );
      }

      const rowsNuevos = rows.filter(
        (r) => !existingMap.has(r.nombre.toLowerCase().trim()),
      );
      const rowsExistentes = rows.filter((r) =>
        existingMap.has(r.nombre.toLowerCase().trim()),
      );

      productosReutilizados = rowsExistentes.length;
      productosCreados = rowsNuevos.length;

      rowsExistentes.forEach((r) => {
        advertencias.push(
          `Fila ${r.rowNum}: ${esServicios ? 'servicio' : 'producto'} "${r.nombre}" ya existía — se reutilizó`,
        );
      });

      if (rowsNuevos.length > 0) {
        if (esServicios) {
          const params: any[] = [];
          let paramIdx = 1;
          const valueRows = rowsNuevos
            .map((r) => {
              params.push(r.nombre, r.descripcion, String(r.costo), userId);
              return `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, NOW())`;
            })
            .join(', ');

          const inserted = await serviceRepoTx.query(
            `INSERT INTO services (nombre, descripcion, "precioBase", created_by, created_at)
             VALUES ${valueRows}
             ON CONFLICT (LOWER(nombre)) DO NOTHING
             RETURNING id, nombre`,
            params,
          );

          inserted.forEach((s: { id: string; nombre: string }) => {
            existingMap.set(s.nombre.toLowerCase().trim(), { id: s.id });
          });

          // ── Recuperar IDs de los que DO NOTHING ignoró ──
          const nombresInsertados = inserted.map((s: any) =>
            s.nombre.toLowerCase().trim(),
          );
          const nombresFaltantes = rowsNuevos
            .filter(
              (r) => !nombresInsertados.includes(r.nombre.toLowerCase().trim()),
            )
            .map((r) => r.nombre.toLowerCase().trim());

          if (nombresFaltantes.length > 0) {
            const faltantes = await serviceRepoTx
              .createQueryBuilder('s')
              .select(['s.id', 's.nombre'])
              .where('LOWER(s.nombre) IN (:...nombres)', {
                nombres: nombresFaltantes,
              })
              .getMany();
            faltantes.forEach((s) => {
              existingMap.set(s.nombre.toLowerCase().trim(), { id: s.id });
            });
          }
        } else {
          const params: any[] = [];
          let paramIdx = 1;
          const valueRows = rowsNuevos
            .map((r) => {
              params.push(
                r.nombre,
                r.descripcion,
                String(r.costo),
                r.categoria!.id,
                userId,
                placeholderBuffer,
                'image/png',
                'default-product.png',
                placeholderSize,
              );
              return `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, NOW())`;
            })
            .join(', ');

          const inserted = await productRepoTx.query(
            `INSERT INTO products (nombre, descripcion, precio, category_id, created_by, image_data, image_mime, image_name, image_size, created_at)
             VALUES ${valueRows}
             ON CONFLICT (LOWER(nombre)) DO NOTHING
             RETURNING id, nombre`,
            params,
          );

          inserted.forEach((p: { id: string; nombre: string }) => {
            existingMap.set(p.nombre.toLowerCase().trim(), { id: p.id });
          });

          // ── Recuperar IDs de los que DO NOTHING ignoró ──
          const nombresInsertados = inserted.map((p: any) =>
            p.nombre.toLowerCase().trim(),
          );
          const nombresFaltantes = rowsNuevos
            .filter(
              (r) => !nombresInsertados.includes(r.nombre.toLowerCase().trim()),
            )
            .map((r) => r.nombre.toLowerCase().trim());

          if (nombresFaltantes.length > 0) {
            const faltantes = await productRepoTx
              .createQueryBuilder('p')
              .select(['p.id', 'p.nombre'])
              .where('LOWER(p.nombre) IN (:...nombres)', {
                nombres: nombresFaltantes,
              })
              .getMany();
            faltantes.forEach((p) => {
              existingMap.set(p.nombre.toLowerCase().trim(), { id: p.id });
            });
          }
        }
      }

      if (rows.length > 0) {
        const itemParams: any[] = [];
        let itemParamIdx = 1;

        const itemValueRows = rows
          .map((r) => {
            const entityId = existingMap.get(r.nombre.toLowerCase().trim())?.id;
            if (!entityId)
              throw new Error(`No se encontró ID para "${r.nombre}"`);

            const placeholders: string[] = [
              `$${itemParamIdx++}`, // quote_id
              `$${itemParamIdx++}`, // product_id o service_id
              `$${itemParamIdx++}`, // cantidad
              `$${itemParamIdx++}`, // unidad
              `$${itemParamIdx++}`, // costo_unitario
            ];

            itemParams.push(
              savedQuote.id,
              entityId,
              r.cantidad,
              r.unidad,
              +r.costo.toFixed(2),
            );

            // ── Calcular valores por empresa ──
            const margens: (number | null)[] = [];
            const precios: number[] = [];
            const subtotales: number[] = [];

            for (const empresaId of empresaIds) {
              const margen = r.margenesPorEmpresa.get(empresaId) ?? null;
              const precioFinal =
                margen !== null
                  ? +(r.costo * (1 + margen / 100)).toFixed(2)
                  : +r.costo.toFixed(2);
              const subtotal = +(precioFinal * r.cantidad).toFixed(2);

              margens.push(margen !== null ? +margen.toFixed(2) : null);
              precios.push(precioFinal);
              subtotales.push(subtotal);
            }

            // ── Pushear en orden: todos márgenes, luego precios, luego subtotales ──
            for (const m of margens) {
              placeholders.push(`$${itemParamIdx++}`);
              itemParams.push(m);
            }
            for (const p of precios) {
              placeholders.push(`$${itemParamIdx++}`);
              itemParams.push(p);
            }
            for (const s of subtotales) {
              placeholders.push(`$${itemParamIdx++}`);
              itemParams.push(s);
            }

            return `(${placeholders.join(', ')})`;
          })
          .join(', ');

        const margenCols = empresaIds.map((id) => `margen_pct${id}`).join(', ');
        const precioCols = empresaIds
          .map((id) => `precio_final${id}`)
          .join(', ');
        const subtotalCols = empresaIds.map((id) => `subtotal${id}`).join(', ');
        const productOrService = esServicios ? 'service_id' : 'product_id';

        await itemRepoTx.query(
          `INSERT INTO quote_items (quote_id, ${productOrService}, cantidad, unidad, costo_unitario, ${margenCols}, ${precioCols}, ${subtotalCols})
     VALUES ${itemValueRows}`,
          itemParams,
        );
      }

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const ivaPct = 16;

      for (const empresaId of empresaIds) {
        const subtotalSum = rows.reduce((acc, r) => {
          const margen = r.margenesPorEmpresa.get(empresaId) ?? null;
          const precioFinal =
            margen !== null
              ? +(r.costo * (1 + margen / 100)).toFixed(2)
              : r.costo;
          return acc + +(precioFinal * r.cantidad).toFixed(2);
        }, 0);

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
