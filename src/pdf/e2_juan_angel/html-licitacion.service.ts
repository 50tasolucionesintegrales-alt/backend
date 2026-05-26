import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

// Helpers globales (ya registrados en otro lado, pero los repetimos por si acaso)
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

function calcLines2(text: string, maxCPL = 55): number {
  if (!text) return 1;
  const plain = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  const lines = plain.split(/\r?\n/);
  let total = 0;
  for (const line of lines) {
    total += line.length === 0 ? 1 : Math.ceil(line.length / maxCPL);
  }
  return Math.max(total, 1);
}

// Devuelve [parteQueCabeEnMaxLines, restoJunto]
// la primera parte es la más larga posible que no supera maxLines líneas
function splitInTwo(text: string, maxLines: number, cpl: number): [string, string] {
  if (!text) return ['', ''];
  const words = text.split(' ');
  let first = '';
  let cutIdx = 0;
  for (let i = 0; i < words.length; i++) {
    const test = first ? `${first} ${words[i]}` : words[i];
    if (calcLines2(test, cpl) > maxLines && first.length > 0) {
      cutIdx = i;
      break;
    }
    first = test;
    cutIdx = i + 1;
  }
  const rest = words.slice(cutIdx).join(' ');
  return [first.trim(), rest.trim()];
}

function reCalcChunkProd2(chunk: any[]): any[] {
  const cnt = new Map<number, number>();
  for (const r of chunk) cnt.set(r.concepto, (cnt.get(r.concepto) || 0) + 1);
  const seen = new Set<number>();
  return chunk.map((r: any) => {
    const isFirst = !seen.has(r.concepto);
    if (isFirst) seen.add(r.concepto);
    return { ...r, isFirstInConcepto: isFirst, rowspan: cnt.get(r.concepto) || 1 };
  });
}

function reCalcChunkSvc2(chunk: any[]): any[] {
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
// EMPRESA 2 — PRODUCTOS (sin cambios)
// ─────────────────────────────────────────────────────────────────

const P2_MAX_FIRST = 16;
const P2_MAX_OTHER = 23;
const P2_FOOTER    = 8;

hbs.registerHelper('licitSmartChunk2', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];
  const chunks: any[][] = [];
  let cur: any[] = [], curLines = 0;
  for (const row of rows) {
    const lines   = Math.max(1, Math.ceil((row.descripcion?.length ?? 0) / 50));
    const isFirst = chunks.length === 0;
    const max     = isFirst ? P2_MAX_FIRST : P2_MAX_OTHER;
    if (curLines + lines > max && cur.length > 0) {
      chunks.push([...cur]);
      cur = [];
      curLines = 0;
    }
    cur.push(row);
    curLines += lines;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.map(reCalcChunkProd2);
});

hbs.registerHelper('licitNeedsSeparatePage2', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;
  const chunks = (hbs.helpers as any).licitSmartChunk2(rows);
  if (!chunks.length) return true;
  const last = chunks[chunks.length - 1];
  const lastLines = last.reduce(
    (s: number, r: any) => s + Math.max(1, Math.ceil((r.descripcion?.length ?? 0) / 50)), 0
  );
  const max = chunks.length === 1 ? P2_MAX_FIRST : P2_MAX_OTHER;
  return (lastLines + P2_FOOTER) > max;
});

// ─────────────────────────────────────────────────────────────────
// EMPRESA 2 — SERVICIOS (VERSIÓN DEFINITIVA SIN FRAGMENTACIÓN EXCESIVA)
// ─────────────────────────────────────────────────────────────────

const S2_MAX_FIRST  = 18;      // Primera página: espacio para tabla
const S2_MAX_OTHER  = 36;      // Páginas siguientes (ajustable según necesidad)
const S2_FOOTER     = 8;
const S2_ROW_BASE   = 1;
const S2_CPL        = 55;

hbs.registerHelper('licitSmartChunkServicios2', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];

  const chunks: any[][] = [];
  let curChunk: any[] = [];
  let curLines = 0;
  let nextIndex = 1; // para el número de ítem

  const getPageLimit = () => (chunks.length === 0 ? S2_MAX_FIRST : S2_MAX_OTHER);
  const flush = () => {
    if (curChunk.length) {
      chunks.push([...curChunk]);
      curChunk = [];
      curLines = 0;
    }
  };

  // Procesa una parte de texto de una fila, colocándola en la página actual o en páginas nuevas
  const addPart = (row: any, text: string, isContinuation: boolean) => {
    if (!text) return;

    const rowLines = S2_ROW_BASE + calcLines2(text, S2_CPL);
    const available = getPageLimit() - curLines;

    // Si cabe completo en la página actual, lo ponemos
    if (rowLines <= available) {
      curChunk.push({ ...row, descripcion: text, isContinuation, globalIndex: isContinuation ? '' : nextIndex++ });
      curLines += rowLines;
      return;
    }

    // No cabe completo. Cerramos la página actual (si tiene contenido)
    if (curChunk.length > 0) flush();

    // Ahora la página está limpia. ¿Cabe entero en una página limpia?
    const cleanPageLimit = getPageLimit();
    if (rowLines <= cleanPageLimit) {
      // Cabe entero: lo colocamos y listo
      curChunk.push({ ...row, descripcion: text, isContinuation, globalIndex: isContinuation ? '' : nextIndex++ });
      curLines = rowLines;
      return;
    }

    // No cabe entero ni siquiera en una página limpia → dividir en DOS partes
    const maxDesc = cleanPageLimit - S2_ROW_BASE;
    const [partA, partB] = splitInTwo(text, maxDesc, S2_CPL);
    if (partA) {
      // Colocar primera parte
      curChunk.push({ ...row, descripcion: partA, isContinuation, globalIndex: isContinuation ? '' : nextIndex++ });
      curLines = S2_ROW_BASE + calcLines2(partA, S2_CPL);
      // Si hay resto, forzar cierre de página y procesar el resto recursivamente
      if (partB) {
        flush();
        addPart(row, partB, true);
      }
    } else {
      // Fallback: texto muy raro, meterlo como está
      curChunk.push({ ...row, descripcion: text, isContinuation, globalIndex: isContinuation ? '' : nextIndex++ });
      curLines = rowLines;
    }
  };

  for (const row of rows) {
    addPart(row, row.descripcion || '', false);
  }
  flush();

  // Recalcular isFirstInConcepto y rowspan
  return chunks.map(chunk => reCalcChunkSvc2(chunk));
});

hbs.registerHelper('licitNeedsSeparatePageServicios2', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;

  const TOTAL_PAGE_LINES = 50;
  const HEADER_FIRST     = 12;
  const HEADER_OTHER     = 2;
  const FOOTER           = S2_FOOTER;

  const chunks = (hbs.helpers as any).licitSmartChunkServicios2(rows);
  if (!chunks.length) return true;

  const isFirst = chunks.length === 1;
  const header  = isFirst ? HEADER_FIRST : HEADER_OTHER;

  const lastChunk = chunks[chunks.length - 1];
  let lastTableLines = 0;
  for (const row of lastChunk) {
    lastTableLines += S2_ROW_BASE + calcLines2(row.descripcion ?? '', S2_CPL);
  }

  return (header + lastTableLines + FOOTER) > TOTAL_PAGE_LINES;
});

function resolveBaseDir() {
  const d = path.join(__dirname);
  if (fs.existsSync(path.join(d, '..', 'templates'))) return path.join(d, '..');
  const s = path.join(process.cwd(), 'src', 'pdf');
  if (fs.existsSync(path.join(s, 'templates'))) return s;
  return path.join(d, '..');
}

@Injectable()
export class HtmlLicitacionService2 implements OnModuleInit, OnModuleDestroy {
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