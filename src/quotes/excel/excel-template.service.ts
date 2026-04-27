import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from 'src/categories/entities/category.entity';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

const EMPRESA_MAP: Record<number, { nombre: string; color: string }> = {
  1: { nombre: 'Goltech', color: '0B5345' },
  2: { nombre: 'Juan Á.', color: '1A5276' },
  3: { nombre: 'Alejandra G.', color: '6C3483' },
  4: { nombre: 'Adrián O', color: '7D6608' },
  5: { nombre: 'Mariana L.', color: '1A5276' },
  6: { nombre: 'Michelle', color: '4A235A' },
  7: { nombre: 'Chalor', color: '922B21' },
  8: { nombre: 'Leyses', color: '1B4F72' },
  9: { nombre: 'Eduardo S', color: '0E6655' },
  10: { nombre: 'Jessica R.', color: '6E2F1A' },
  11: { nombre: 'Grupo Álamo', color: '2E4057' },
  12: { nombre: 'Hugo R', color: '424949' },
};

const C = {
  DARK_BG: '0D2B1F',
  MED_GRN: '145A32',
  LIGHT_GY: 'EAECEE',
  DATA_F: 'EBF5EB',
  FORM_F: 'F4F6F6',
  GAN_F: 'E8F8F5',
  SEP_C: 'BBBBBB',
  GOLD: 'FFD700',
  DATA_T: '154360',
  GAN_T: '1E8449',
  ARROW_T: '888888',
  SUB_H: '1B6248',
  WHITE: 'FFFFFF',
  GRN_SUM: '00A86B',
  IVA_F: 'D6EAF8',
  IVA_T: '145A32',
  TOT_F: '1A5276',
  ORANGE: 'E67E22',
  ORANGE_F: 'FEF5EC',
  LOCKED_F: 'D5D8DC',
};

const THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } };
const MED: ExcelJS.Border = { style: 'medium', color: { argb: 'FF000000' } };
const ALL_B = { top: THIN, bottom: THIN, left: THIN, right: THIN };

function fill(color: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
}
function font(
  color: string,
  size: number,
  bold = false,
): Partial<ExcelJS.Font> {
  return { name: 'Arial', size, bold, color: { argb: 'FF' + color } };
}
function align(
  horizontal: ExcelJS.Alignment['horizontal'] = 'left',
  wrapText = false,
): Partial<ExcelJS.Alignment> {
  return { horizontal, vertical: 'middle', wrapText };
}
function border(
  top?: ExcelJS.Border,
  bottom?: ExcelJS.Border,
  left?: ExcelJS.Border,
  right?: ExcelJS.Border,
): Partial<ExcelJS.Borders> {
  const b: Partial<ExcelJS.Borders> = {};
  if (top) b.top = top;
  if (bottom) b.bottom = bottom;
  if (left) b.left = left;
  if (right) b.right = right;
  return b;
}
function fillRange(
  ws: ExcelJS.Worksheet,
  startCol: number,
  endCol: number,
  row: number,
  color: string,
) {
  for (let c = startCol; c <= endCol; c++)
    ws.getCell(row, c).fill = fill(color);
}
function outerBorder(
  ws: ExcelJS.Worksheet,
  startCol: number,
  endCol: number,
  startRow: number,
  endRow: number,
  style: 'thin' | 'medium' = 'thin',
) {
  const s: ExcelJS.Border = { style, color: { argb: 'FF000000' } };
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cel = ws.getCell(r, c);
      const b: Partial<ExcelJS.Borders> = {};
      if (r === startRow) b.top = s;
      if (r === endRow) b.bottom = s;
      if (c === startCol) b.left = s;
      if (c === endCol) b.right = s;
      cel.border = b;
    }
  }
}
function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

@Injectable()
export class ExcelTemplateService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async generateTemplate(
    empresaIds: number[],
    numProductos: number = 10,
    tipo: 'productos' | 'servicios' = 'productos',
  ): Promise<Buffer> {
    const empresas = empresaIds.map((id) => {
      const emp = EMPRESA_MAP[id];
      if (!emp) throw new Error(`Empresa ${id} no válida`);
      return { id, ...emp };
    });

    const categories = await this.categoryRepo.find({
      order: { nombre: 'ASC' },
    });
    const catNames = categories.map((c) => c.nombre);
    const esServicios = tipo === 'servicios'; // ← flag principal

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SinCuenta';
    wb.created = new Date();

    const ws = wb.addWorksheet('Cotización', {
      pageSetup: { fitToPage: true, fitToWidth: 1 },
    });

    const wsCat = wb.addWorksheet('_Categorias');
    wsCat.state = 'hidden';
    catNames.forEach((name, i) => {
      wsCat.getCell(i + 1, 1).value = name;
    });

    const wsMeta = wb.addWorksheet('_Meta');
    wsMeta.state = 'hidden';
    wsMeta.getCell(1, 1).value = 'SINCUENTA_V2';
    wsMeta.getCell(2, 1).value = empresaIds.join(',');
    wsMeta.getCell(3, 1).value = numProductos;
    wsMeta.getCell(4, 1).value = tipo; // ← guardar tipo

    const N_EMP = empresas.length;
    const LAST_COL = 7 + N_EMP * 5;
    const DATA_START = 13;
    const DATA_END = DATA_START + numProductos - 1;
    const ROW_SUBTOT = DATA_END + 1;
    const ROW_IVA = DATA_END + 2;
    const ROW_TOTAL = DATA_END + 3;

    // ── Anchos ──
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 25;
    ws.getColumn(3).width = 25;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 10;
    ws.getColumn(7).width = 15;
    for (let ei = 0; ei < N_EMP; ei++) {
      ws.getColumn(8 + ei * 5 + 0).width = 10;
      ws.getColumn(8 + ei * 5 + 1).width = 15;
      ws.getColumn(8 + ei * 5 + 2).width = 15;
      ws.getColumn(8 + ei * 5 + 3).width = 16;
      ws.getColumn(8 + ei * 5 + 4).width = 14;
    }

    // ── Alturas ──
    ws.getRow(1).height = 19.5;
    ws.getRow(2).height = 48;
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 4.5;
    ws.getRow(5).height = 24;
    ws.getRow(6).height = 24;
    ws.getRow(7).height = 24;
    ws.getRow(8).height = 4.5;
    ws.getRow(9).height = 28;
    ws.getRow(10).height = 24;
    ws.getRow(11).height = 30;
    ws.getRow(12).height = 4.5;
    for (let r = DATA_START; r <= DATA_END; r++) ws.getRow(r).height = 22;
    ws.getRow(ROW_SUBTOT).height = 24;
    ws.getRow(ROW_IVA).height = 24;
    ws.getRow(ROW_TOTAL).height = 24;

    // ── FILA 1 ──
    fillRange(ws, 1, LAST_COL, 1, C.DARK_BG);
    ws.mergeCells(1, 1, 1, LAST_COL);
    const r1 = ws.getCell(1, 1);
    r1.value = '  SIN CUENTA · SOLUCIONES INTEGRALES';
    r1.font = font('A9DFBF', 10, true);
    r1.alignment = align('left');
    r1.protection = { locked: true };

    const logoPath = path.join(
      process.cwd(),
      'src',
      'pdf',
      'assets',
      'logo.png',
    );
    if (fs.existsSync(logoPath)) {
      const logoId = wb.addImage({ filename: logoPath, extension: 'png' });
      ws.addImage(logoId, {
        tl: { col: LAST_COL - 2, row: 0 } as any,
        br: { col: LAST_COL, row: 3 } as any,
        editAs: 'oneCell',
      });
    }

    // ── FILAS 2-3 ──
    fillRange(ws, 1, LAST_COL, 2, C.DARK_BG);
    fillRange(ws, 1, LAST_COL, 3, C.DARK_BG);
    ws.mergeCells(2, 1, 3, LAST_COL);
    const r2 = ws.getCell(2, 1);
    r2.value = '  COTIZACIÓN';
    r2.font = font(C.WHITE, 30, true);
    r2.alignment = align('left');
    r2.protection = { locked: true };

    // ── FILA 4 ──
    fillRange(ws, 1, LAST_COL, 4, C.MED_GRN);
    ws.mergeCells(4, 1, 4, LAST_COL);

    // ── FILA 5 – Título ──
    fillRange(ws, 1, 2, 5, C.MED_GRN);
    ws.mergeCells(5, 1, 5, 2);
    const r5a = ws.getCell(5, 1);
    r5a.value = '  Título:';
    r5a.font = font(C.WHITE, 11, true);
    r5a.alignment = align('center');
    r5a.protection = { locked: true };
    outerBorder(ws, 1, 2, 5, 5);

    const titleEnd = Math.min(8, LAST_COL);
    fillRange(ws, 3, titleEnd, 5, C.LIGHT_GY);
    ws.mergeCells(5, 3, 5, titleEnd);
    const r5b = ws.getCell(5, 3);
    r5b.font = font(C.MED_GRN, 11, true);
    r5b.alignment = align('left');
    r5b.protection = { locked: false };
    outerBorder(ws, 3, titleEnd, 5, 5);

    // ── FILA 6 – Tipo (pre-llenado y bloqueado) ──
    fillRange(ws, 1, 2, 6, C.MED_GRN);
    ws.mergeCells(6, 1, 6, 2);
    const r6a = ws.getCell(6, 1);
    r6a.value = '  Tipo:';
    r6a.font = font(C.WHITE, 11, true);
    r6a.alignment = align('center');
    r6a.protection = { locked: true };
    outerBorder(ws, 1, 2, 6, 6);

    fillRange(ws, 3, titleEnd, 6, C.LIGHT_GY);
    ws.mergeCells(6, 3, 6, titleEnd);
    const r6b = ws.getCell(6, 3);
    r6b.value = tipo; // ← pre-llenado con el tipo
    r6b.font = font(C.MED_GRN, 11, true);
    r6b.alignment = align('left');
    r6b.protection = { locked: true }; // ← bloqueado
    outerBorder(ws, 3, titleEnd, 6, 6);

    // ── FILA 7 – Descripción ──
    fillRange(ws, 1, 2, 7, C.MED_GRN);
    ws.mergeCells(7, 1, 7, 2);
    const r7a = ws.getCell(7, 1);
    r7a.value = '  Descripción:';
    r7a.font = font(C.WHITE, 11, true);
    r7a.alignment = align('center');
    r7a.protection = { locked: true };
    outerBorder(ws, 1, 2, 7, 7);

    fillRange(ws, 3, titleEnd, 7, C.LIGHT_GY);
    ws.mergeCells(7, 3, 7, titleEnd);
    const r7b = ws.getCell(7, 3);
    r7b.font = font(C.MED_GRN, 11);
    r7b.alignment = align('left');
    r7b.protection = { locked: false };
    outerBorder(ws, 3, titleEnd, 7, 7);

    // ── FILA 8 – Separador verde ──
    fillRange(ws, 1, LAST_COL, 8, C.MED_GRN);
    ws.mergeCells(8, 1, 8, LAST_COL);

    // ── FILAS 9-10 – Headers ──
    const fixedHdrs: [number, string, boolean][] = [
      [1, '#', false],
      [2, 'Nombre\n(referencia)', true],
      [3, 'Descripción', true],
      [4, 'Categoría', true],
      [5, 'Cantidad', false],
      [6, 'Unidad', false],
      [7, 'Costo\nUnitario', true],
    ];
    for (const [colIdx, label, wrap] of fixedHdrs) {
      // Columna D en gris si es servicios
      const hColor = esServicios && colIdx === 4 ? C.ARROW_T : C.MED_GRN;
      fillRange(ws, colIdx, colIdx, 9, hColor);
      fillRange(ws, colIdx, colIdx, 10, hColor);
      ws.mergeCells(9, colIdx, 10, colIdx);
      const c = ws.getCell(9, colIdx);
      c.value = esServicios && colIdx === 4 ? 'N/A' : label;
      c.font = font(C.WHITE, 11, true);
      c.alignment = align('center', wrap);
      c.protection = { locked: true };
      outerBorder(ws, colIdx, colIdx, 9, 10);
    }

    for (let ei = 0; ei < N_EMP; ei++) {
      const emp = empresas[ei];
      const bc = 8 + ei * 5;
      const ec = bc + 4;

      fillRange(ws, bc, ec, 9, emp.color);
      ws.mergeCells(9, bc, 9, ec);
      const hdr = ws.getCell(9, bc);
      hdr.value = emp.nombre.toUpperCase();
      hdr.font = font(C.WHITE, 11, true);
      hdr.alignment = align('center');
      hdr.protection = { locked: true };
      outerBorder(ws, bc, ec, 9, 9);

      const subLabels = [
        '% Ítem',
        'Precio\nFinal ($)',
        'Subtotal\nBase ($)',
        'Subtotal\n+Margen ($)',
        'Ganancia ($)',
      ];
      for (let ci = 0; ci < 5; ci++) {
        const c = ws.getCell(10, bc + ci);
        c.value = subLabels[ci];
        c.fill = fill(C.SUB_H);
        c.font = font(C.WHITE, 10, true);
        c.alignment = align('center', true);
        c.border = ALL_B;
        c.protection = { locked: true };
      }
    }

    // ── FILA 11 – % Margen global ──
    fillRange(ws, 1, 7, 11, C.MED_GRN);
    ws.mergeCells(11, 1, 11, 7);
    const r11 = ws.getCell(11, 1);
    r11.value = '  % MARGEN GLOBAL';
    r11.font = font(C.WHITE, 11, true);
    r11.alignment = align('left');
    r11.border = border(MED, MED, MED, MED);
    r11.protection = { locked: true };

    for (let ei = 0; ei < N_EMP; ei++) {
      const bc = 8 + ei * 5;
      const arrowSt = bc + 1;
      const arrowEn = bc + 4;

      const pctCell = ws.getCell(11, bc);
      pctCell.fill = fill(C.GOLD);
      pctCell.font = font(C.MED_GRN, 14, true);
      pctCell.alignment = align('center');
      pctCell.numFmt = '0.00';
      pctCell.border = border(MED, MED, MED, THIN);
      pctCell.protection = { locked: false };

      fillRange(ws, arrowSt, arrowEn, 11, C.FORM_F);
      ws.mergeCells(11, arrowSt, 11, arrowEn);
      const arrowCell = ws.getCell(11, arrowSt);
      arrowCell.value = esServicios
        ? '← % que aplica a todos los servicios'
        : '← % que aplica a todos los productos';
      arrowCell.font = font(C.ARROW_T, 9);
      arrowCell.alignment = align('left');
      arrowCell.protection = { locked: true };
      outerBorder(ws, arrowSt, arrowEn, 11, 11, 'medium');
    }

    // ── FILA 12 – Separador gris ──
    fillRange(ws, 1, LAST_COL, 12, C.SEP_C);
    ws.mergeCells(12, 1, 12, LAST_COL);

    // ── FILAS DE DATOS ──
    for (let r = DATA_START; r <= DATA_END; r++) {
      const cA = ws.getCell(r, 1);
      cA.value = r - DATA_START + 1;
      cA.fill = fill(C.FORM_F);
      cA.font = font(C.ARROW_T, 11, true);
      cA.alignment = align('center');
      cA.border = ALL_B;
      cA.protection = { locked: true };

      const cB = ws.getCell(r, 2);
      cB.fill = fill(C.DATA_F);
      cB.font = font(C.DATA_T, 11, true);
      cB.alignment = align('left');
      cB.border = ALL_B;
      cB.protection = { locked: false };

      const cC = ws.getCell(r, 3);
      cC.fill = fill(C.DATA_F);
      cC.font = font(C.DATA_T, 11);
      cC.alignment = align('left');
      cC.border = ALL_B;
      cC.protection = { locked: false };

      // ── Columna D: N/A bloqueada para servicios ──
      const cD = ws.getCell(r, 4);
      if (esServicios) {
        cD.value = 'N/A';
        cD.fill = fill(C.LOCKED_F);
        cD.font = font(C.ARROW_T, 11);
        cD.alignment = align('center');
        cD.border = ALL_B;
        cD.protection = { locked: true };
      } else {
        cD.fill = fill(C.DATA_F);
        cD.font = font(C.DATA_T, 11);
        cD.alignment = align('left');
        cD.border = ALL_B;
        cD.protection = { locked: false };
      }

      const cE = ws.getCell(r, 5);
      cE.fill = fill(C.DATA_F);
      cE.font = font(C.DATA_T, 11);
      cE.alignment = align('center');
      cE.border = ALL_B;
      cE.numFmt = '#,##0';
      cE.protection = { locked: false };

      // ── Unidad pre-llenada según tipo ──
      const cF = ws.getCell(r, 6);
      cF.value = 'pieza';
      cF.fill = fill(C.DATA_F);
      cF.font = font(C.DATA_T, 11);
      cF.alignment = align('center');
      cF.border = ALL_B;
      cF.protection = { locked: false };

      const cG = ws.getCell(r, 7);
      cG.fill = fill(C.DATA_F);
      cG.font = font(C.DATA_T, 11);
      cG.alignment = align('right');
      cG.border = ALL_B;
      cG.numFmt = '$#,##0.00';
      cG.protection = { locked: false };

      for (let ei = 0; ei < N_EMP; ei++) {
        const bc = 8 + ei * 5;
        const pctCol = bc,
          pfCol = bc + 1,
          sbCol = bc + 2,
          smCol = bc + 3,
          ganCol = bc + 4;
        const pctL = colLetter(pctCol);
        const pfL = colLetter(pfCol);
        const gRef = `$${pctL}$11`;

        const cPct = ws.getCell(r, pctCol);
        cPct.fill = fill(C.DATA_F);
        cPct.font = font(C.DATA_T, 11);
        cPct.alignment = align('center');
        cPct.border = ALL_B;
        cPct.numFmt = '0.00';
        cPct.protection = { locked: false };

        const cPf = ws.getCell(r, pfCol);
        cPf.value = {
          formula: `IF(G${r}="","",ROUND(G${r}*(1+(IF(${pctL}${r}<>"",${pctL}${r},${gRef}))/100)-0.0000000001,2))`,
        };
        cPf.fill = fill(C.FORM_F);
        cPf.font = font('333333', 11);
        cPf.alignment = align('right');
        cPf.border = ALL_B;
        cPf.numFmt = '$#,##0.00';
        cPf.protection = { locked: true };

        const cSb = ws.getCell(r, sbCol);
        cSb.value = { formula: `IF(G${r}="","",ROUND(G${r}*E${r},2))` };
        cSb.fill = fill(C.FORM_F);
        cSb.font = font('333333', 11);
        cSb.alignment = align('right');
        cSb.border = ALL_B;
        cSb.numFmt = '$#,##0.00';
        cSb.protection = { locked: true };

        const cSm = ws.getCell(r, smCol);
        cSm.value = {
          formula: `IF(G${r}="","",ROUND(${pfL}${r}*E${r}-0.0000000001,2))`,
        };
        cSm.fill = fill(C.FORM_F);
        cSm.font = font('333333', 11);
        cSm.alignment = align('right');
        cSm.border = ALL_B;
        cSm.numFmt = '$#,##0.00';
        cSm.protection = { locked: true };

        const cGan = ws.getCell(r, ganCol);
        cGan.value = {
          formula: `IF(G${r}="","",ROUND(G${r}*E${r}*(IF(${pctL}${r}<>"",${pctL}${r},${gRef}))/100-0.0000000001,2))`,
        };
        cGan.fill = fill(C.GAN_F);
        cGan.font = font(C.GAN_T, 11, true);
        cGan.alignment = align('right');
        cGan.border = ALL_B;
        cGan.numFmt = '$#,##0.00';
        cGan.protection = { locked: true };
      }
    }

    // ── Validaciones ──
    const dv = (ws as any).dataValidations;

    dv.add(`B${DATA_START}:B${DATA_END}`, {
      type: 'textLength',
      operator: 'between',
      formulae: [3, 255],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Nombre inválido',
      error: 'El nombre debe tener entre 3 y 255 caracteres',
    });
    dv.add(`C${DATA_START}:C${DATA_END}`, {
      type: 'textLength',
      operator: 'between',
      formulae: [1, 300],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Descripción inválida',
      error: 'La descripción debe tener entre 1 y 300 caracteres',
    });

    // ── Categoría solo para productos ──
    if (!esServicios) {
      dv.add(`D${DATA_START}:D${DATA_END}`, {
        type: 'list',
        allowBlank: true,
        formulae: [`_Categorias!$A$1:$A$${catNames.length}`],
        showErrorMessage: true,
        errorTitle: 'Categoría inválida',
        error: 'Selecciona una categoría de la lista',
      });
    }

    dv.add(`E${DATA_START}:E${DATA_END}`, {
      type: 'whole',
      operator: 'greaterThan',
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Cantidad inválida',
      error: 'Ingresa un número entero mayor a 0',
    });
    dv.add(`G${DATA_START}:G${DATA_END}`, {
      type: 'decimal',
      operator: 'greaterThan',
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Costo inválido',
      error: 'Ingresa un número mayor a 0',
    });
    for (let ei = 0; ei < N_EMP; ei++) {
      const pctL = colLetter(8 + ei * 5);
      dv.add(`${pctL}${DATA_START}:${pctL}${DATA_END}`, {
        type: 'decimal',
        operator: 'between',
        formulae: [0, 100],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: '% inválido',
        error: 'Ingresa un porcentaje entre 0 y 100',
      });
    }

    for (let ei = 0; ei < N_EMP; ei++) {
      const pctL = colLetter(8 + ei * 5);
      dv.add(`${pctL}11`, {
        type: 'decimal',
        operator: 'between',
        formulae: [0, 100],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: '% global inválido',
        error: 'El margen global debe ser entre 0 y 100',
      });
    }

    // ── Totales ──
    const totalDefs = [
      {
        row: ROW_SUBTOT,
        label: '  SUBTOTAL  (sin IVA)',
        bg: C.MED_GRN,
        fc: C.WHITE,
        fcg: C.GRN_SUM,
      },
      {
        row: ROW_IVA,
        label: '  IVA  (16%)',
        bg: C.IVA_F,
        fc: C.IVA_T,
        fcg: C.IVA_T,
      },
      {
        row: ROW_TOTAL,
        label: '  TOTAL FINAL  (c/IVA)',
        bg: C.TOT_F,
        fc: C.WHITE,
        fcg: C.WHITE,
      },
    ];

    for (const { row, label, bg, fc: fcolor, fcg } of totalDefs) {
      fillRange(ws, 1, LAST_COL, row, bg);
      ws.mergeCells(row, 1, row, 7);
      const lc = ws.getCell(row, 1);
      lc.value = label;
      lc.font = font(fcolor, 11, true);
      lc.alignment = align('left');
      lc.border = border(MED, MED, MED, MED);
      lc.protection = { locked: true };

      for (let ei = 0; ei < N_EMP; ei++) {
        const bc = 8 + ei * 5;
        const sbCol = bc + 2,
          smCol = bc + 3,
          ganCol = bc + 4;
        const pctCol = bc,
          pfCol = bc + 1;
        const sbL = colLetter(sbCol);
        const smL = colLetter(smCol);
        const ganL = colLetter(ganCol);

        let fSb: string, fSm: string, fGan: string;
        if (row === ROW_SUBTOT) {
          fSb = `ROUND(SUM(${sbL}${DATA_START}:${sbL}${DATA_END}),2)`;
          fSm = `ROUND(SUM(${smL}${DATA_START}:${smL}${DATA_END}),2)`;
          fGan = `ROUND(SUM(${ganL}${DATA_START}:${ganL}${DATA_END}),2)`;
        } else if (row === ROW_IVA) {
          fSb = `ROUND(${sbL}${ROW_SUBTOT}*16/100,2)`;
          fSm = `ROUND(${smL}${ROW_SUBTOT}*16/100,2)`;
          fGan = `ROUND(${ganL}${ROW_SUBTOT}*16/100,2)`;
        } else {
          fSb = `ROUND(${sbL}${ROW_SUBTOT}+${sbL}${ROW_IVA},2)`;
          fSm = `ROUND(${smL}${ROW_SUBTOT}+${smL}${ROW_IVA},2)`;
          fGan = `ROUND(${ganL}${ROW_SUBTOT}+${ganL}${ROW_IVA},2)`;
        }

        const tcSb = ws.getCell(row, sbCol);
        tcSb.value = { formula: fSb };
        tcSb.fill = fill(bg);
        tcSb.font = font(fcolor, 11, true);
        tcSb.alignment = align('right');
        tcSb.border = ALL_B;
        tcSb.numFmt = '$#,##0.00';
        tcSb.protection = { locked: true };

        const tcSm = ws.getCell(row, smCol);
        tcSm.value = { formula: fSm };
        tcSm.fill = fill(row === ROW_TOTAL ? C.ORANGE : bg);
        tcSm.font = font(row === ROW_TOTAL ? C.WHITE : fcolor, 11, true);
        tcSm.alignment = align('right');
        tcSm.border = ALL_B;
        tcSm.numFmt = '$#,##0.00';
        tcSm.protection = { locked: true };

        const tcGan = ws.getCell(row, ganCol);
        tcGan.value = { formula: fGan };
        tcGan.fill = fill(bg);
        tcGan.font = font(fcg, 11, true);
        tcGan.alignment = align('right');
        tcGan.border = ALL_B;
        tcGan.numFmt = '$#,##0.00';
        tcGan.protection = { locked: true };

        ws.getCell(row, pctCol).fill = fill(bg);
        ws.getCell(row, pctCol).border = border(MED, MED, MED);
        ws.getCell(row, pctCol).protection = { locked: true };
        ws.getCell(row, pfCol).fill = fill(bg);
        ws.getCell(row, pfCol).border = border(MED, MED);
        ws.getCell(row, pfCol).protection = { locked: true };
        ws.getCell(row, ganCol).border = border(MED, MED, THIN, MED);
      }
    }

    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 12 }];

    await (ws as any).protect('sincuenta2024', {
      sheet: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      deleteColumns: false,
      deleteRows: false,
      sort: false,
      autoFilter: false,
      selectLockedCells: true,
      selectUnlockedCells: true,
    });

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
