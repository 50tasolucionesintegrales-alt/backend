import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

// Helpers globales (se asume que ya están registrados en otro lado)
if (!hbs.helpers['licit_money']) {
  hbs.registerHelper('licit_money', (n: any) => {
    const num = Number(n ?? 0);
    return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  });
  hbs.registerHelper('licit_eq', (a: any, b: any) => a === b);
  hbs.registerHelper('licit_gt', (a: any, b: any) => Number(a) > Number(b));
  hbs.registerHelper('licit_and', (a: any, b: any) => !!(a && b));
  hbs.registerHelper('licit_roman', (index: number) => {
    const n = ['I','II','III','IV','V','VI','VII','VIII','IX','X',
               'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
    return n[Number(index)] ?? String(Number(index) + 1);
  });
}

// ─────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────

function calcLines(text: string, maxCPL = 55): number {
  if (!text) return 1;
  const plain = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  const lines = plain.split(/\r?\n/);
  let total = 0;
  for (const line of lines) {
    total += line.length === 0 ? 1 : Math.ceil(line.length / maxCPL);
  }
  return Math.max(total, 1);
}

// Divide el texto en dos partes: la primera cabe en maxLines, el resto se devuelve junto.
function splitInTwo(text: string, maxLines: number, cpl: number): [string, string] {
  if (!text) return ['', ''];
  const words = text.split(' ');
  let first = '';
  let cutIdx = 0;
  for (let i = 0; i < words.length; i++) {
    const test = first ? `${first} ${words[i]}` : words[i];
    if (calcLines(test, cpl) > maxLines && first.length > 0) {
      cutIdx = i;
      break;
    }
    first = test;
    cutIdx = i + 1;
  }
  const rest = words.slice(cutIdx).join(' ');
  return [first.trim(), rest.trim()];
}

function reCalcChunkProd(chunk: any[]): any[] {
  const cnt = new Map<number, number>();
  for (const r of chunk) cnt.set(r.concepto, (cnt.get(r.concepto) || 0) + 1);
  const seen = new Set<number>();
  return chunk.map((r: any) => {
    const isFirst = !seen.has(r.concepto);
    if (isFirst) seen.add(r.concepto);
    return { ...r, isFirstInConcepto: isFirst, rowspan: cnt.get(r.concepto) || 1 };
  });
}

function reCalcChunkSvc(chunk: any[]): any[] {
  const cnt = new Map<number, number>();
  for (const r of chunk) {
    if (!r.isContinuation) cnt.set(r.concepto, (cnt.get(r.concepto) || 0) + 1);
  }
  const seen = new Set<number>();
  return chunk.map((r: any) => {
    if (r.isContinuation) return { ...r, isFirstInConcepto: false, rowspan: 1 };
    const isFirst = !seen.has(r.concepto);
    if (isFirst) seen.add(r.concepto);
    return { ...r, isFirstInConcepto: isFirst, rowspan: cnt.get(r.concepto) || 1 };
  });
}

// ─────────────────────────────────────────────────────────────────
// EMPRESA 3
// padding-top: 30mm, padding-bottom: 15mm → espacio similar a empresa 1
// ─────────────────────────────────────────────────────────────────

// PRODUCTOS (sin cambios significativos)
const P3_MAX_FIRST = 20;
const P3_MAX_OTHER = 26;
const P3_FOOTER    = 8;

hbs.registerHelper('licitSmartChunk3', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];
  const chunks: any[][] = [];
  let cur: any[] = [], curLines = 0;
  for (const row of rows) {
    const lines   = Math.max(1, Math.ceil((row.descripcion?.length ?? 0) / 50));
    const isFirst = chunks.length === 0;
    const max     = isFirst ? P3_MAX_FIRST : P3_MAX_OTHER;
    if (curLines + lines > max && cur.length > 0) {
      chunks.push([...cur]);
      cur = [];
      curLines = 0;
    }
    cur.push(row);
    curLines += lines;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.map(reCalcChunkProd);
});

hbs.registerHelper('licitNeedsSeparatePage3', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;
  const chunks = (hbs.helpers as any).licitSmartChunk3(rows);
  if (!chunks.length) return true;
  const last = chunks[chunks.length - 1];
  const lastLines = last.reduce(
    (s: number, r: any) => s + Math.max(1, Math.ceil((r.descripcion?.length ?? 0) / 50)), 0
  );
  const max = chunks.length === 1 ? P3_MAX_FIRST : P3_MAX_OTHER;
  return (lastLines + P3_FOOTER) > max;
});

// ================= SERVICIOS CORREGIDOS (con llenado optimizado) =================
const S3_ROW_BASE   = 1;
const S3_MAX_FIRST  = 24;
const S3_MAX_OTHER  = 46;               // Aumentado de 36 a 46 para maximizar espacio
const S3_FOOTER     = 8;
const S3_CPL        = 55;

hbs.registerHelper('licitSmartChunkServicios3', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];

  // Copia local para poder insertar filas pendientes sin mutar el original
  const pendingRows = [...rows];
  const chunks: any[][] = [];
  let curChunk: any[] = [];
  let curLines = 0;
  let globalCounter = 1;

  const maxForPage = (idx: number) => (idx === 0 ? S3_MAX_FIRST : S3_MAX_OTHER);
  const flush = () => {
    if (curChunk.length) {
      chunks.push([...curChunk]);
      curChunk = [];
      curLines = 0;
    }
  };

  // Procesa una fila (puede ser original o una parte de una división)
  const processRow = (row: any, isContinuation: boolean = false) => {
    const text = row.descripcion || '';
    const descLines = calcLines(text, S3_CPL);
    const totalLines = S3_ROW_BASE + descLines;
    const pageIdx = chunks.length;
    const limit = maxForPage(pageIdx);
    const available = limit - curLines;

    // Si cabe completo en la página actual
    if (totalLines <= available) {
      curChunk.push({
        ...row,
        descripcion: text,
        isContinuation,
        globalIndex: isContinuation ? '' : globalCounter++
      });
      curLines += totalLines;
      return true; // se colocó completamente
    }

    // No cabe completo. Si la página actual no está vacía, la cerramos y reiniciamos
    if (curChunk.length > 0) {
      flush();
      // Reintentamos en página nueva
      return processRow(row, isContinuation);
    }

    // Página limpia. ¿Cabe completo en una página limpia?
    if (totalLines <= limit) {
      curChunk.push({
        ...row,
        descripcion: text,
        isContinuation,
        globalIndex: isContinuation ? '' : globalCounter++
      });
      curLines = totalLines;
      return true;
    }

    // No cabe completo ni en página limpia → dividir en dos partes
    const maxDesc = limit - S3_ROW_BASE;
    if (maxDesc <= 0) {
      // fallback
      curChunk.push({
        ...row,
        descripcion: text.substring(0, 100) + '…',
        isContinuation,
        globalIndex: isContinuation ? '' : globalCounter++
      });
      curLines = S3_ROW_BASE + calcLines(curChunk[0].descripcion, S3_CPL);
      return true;
    }

    const [partA, partB] = splitInTwo(text, maxDesc, S3_CPL);
    if (!partA) {
      // fallback
      curChunk.push({ ...row, descripcion: text, isContinuation, globalIndex: isContinuation ? '' : globalCounter++ });
      curLines = totalLines;
      return true;
    }

    // Colocar primera parte
    curChunk.push({
      ...row,
      descripcion: partA,
      isContinuation,
      globalIndex: isContinuation ? '' : globalCounter++
    });
    curLines = S3_ROW_BASE + calcLines(partA, S3_CPL);

    // Si hay segunda parte, la insertamos como una nueva fila justo después de la actual
    // para que continúe el flujo normal (sin cerrar la página aún).
    if (partB) {
      // Insertamos la segunda parte como una fila adicional en el array de trabajo
      // La ubicamos al inicio de pendingRows para que se procese inmediatamente después de esta fila.
      pendingRows.unshift({ ...row, descripcion: partB, isContinuation: true });
    }
    return true; // la fila original se procesó (parcialmente)
  };

  // Procesamos todas las filas de la cola (se van agregando nuevas según divisiones)
  while (pendingRows.length > 0) {
    const row = pendingRows.shift();
    if (row) {
      processRow(row, row.isContinuation || false);
    }
  }
  flush();

  // Recalcular rowspans e isFirstInConcepto
  return chunks.map(chunk => reCalcChunkSvc(chunk));
});

hbs.registerHelper('licitNeedsSeparatePageServicios3', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;

  const TOTAL_PAGE_LINES = 58;       // Aumentado a 58 para reflejar el nuevo S3_MAX_OTHER
  const HEADER_FIRST = 14;           // líneas que ocupa el encabezado en primera página
  const HEADER_OTHER = 2;            // encabezado simplificado en páginas siguientes
  const FOOTER = S3_FOOTER;

  const chunks = (hbs.helpers as any).licitSmartChunkServicios3(rows);
  if (!chunks.length) return true;

  const isFirst = chunks.length === 1;
  const header = isFirst ? HEADER_FIRST : HEADER_OTHER;

  const lastChunk = chunks[chunks.length - 1];
  let lastTableLines = 0;
  for (const row of lastChunk) {
    lastTableLines += S3_ROW_BASE + calcLines(row.descripcion || '', S3_CPL);
  }

  const needed = header + lastTableLines + FOOTER;
  return needed > TOTAL_PAGE_LINES;
});

// ─────────────────────────────────────────────────────────────────
// SERVICE (sin cambios)
// ─────────────────────────────────────────────────────────────────

function resolveBaseDir() {
  const d = path.join(__dirname);
  if (fs.existsSync(path.join(d, '..', 'templates'))) return path.join(d, '..');
  const s = path.join(process.cwd(), 'src', 'pdf');
  if (fs.existsSync(path.join(s, 'templates'))) return s;
  return path.join(d, '..');
}

@Injectable()
export class HtmlLicitacionService3 implements OnModuleInit, OnModuleDestroy {
  private templates = new Map<string, hbs.TemplateDelegate>();
  private browser!: Browser;
  private baseDir = resolveBaseDir();

  async onModuleInit() {
    this.browser = await chromium.launch({ args: ['--no-sandbox'] });
  }

  async onModuleDestroy() {
    if (this.browser) await this.browser.close();
  }

  private getTemplate(name: string) {
    if (!this.templates.has(name)) {
      const file = path.join(this.baseDir, 'templates', `${name}.hbs`);
      this.templates.set(name, hbs.compile(fs.readFileSync(file, 'utf8'), { noEscape: true }));
    }
    return this.templates.get(name)!;
  }

  async renderToPdf(templateName: string, data: any): Promise<Buffer> {
    const html    = this.getTemplate(templateName)(data);
    const tmpFile = path.join(this.baseDir, `__tmp_${templateName}_${Date.now()}.html`);
    fs.writeFileSync(tmpFile, html, 'utf8');

    const ctx  = await this.browser.newContext();
    const page = await ctx.newPage();
    await page.goto('file://' + tmpFile.replace(/\\/g, '/'), { waitUntil: 'load' });

    const pdf = await page.pdf({ format: 'Letter', printBackground: true });

    await ctx.close();
    try { fs.unlinkSync(tmpFile); } catch {}
    return pdf;
  }
}